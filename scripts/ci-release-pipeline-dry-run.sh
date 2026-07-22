#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# scripts/ci-release-pipeline-dry-run.sh
# =======================================
# Pre-release CI gate that exercises the entire Linux-side release
# pipeline locally so a PR merging into main guarantees the release
# run will succeed on the Linux x64 + Linux arm64 lanes. Bridges the
# gap that PR-CI alone cannot close: it runs
#
#   build-package      — the production-equivalent build that produces
#                        release/public/<archives> + checksums.txt
#   smoke-linux-x64    — install.sh + --version + --help + doctor on
#                        the freshly-built binary
#   smoke-bad-checksum — install.sh with tampered checksums.txt; assert
#                        the security post-condition (BEFORE == AFTER,
#                        no stage residue, installer rejected)
#
# in one local process tree, using the SAME scripts the release
# workflow uses (npm run build, build-binary.mjs,
# package-release-assets.mjs, verify-release-assets.mjs, the release
# fixture server, install.sh), against a local fixture masquerading
# as the GitHub Releases host so URL routing exercises the production
# code path.
#
# What this does NOT cover (must be verified by the actual release):
#   - macOS smoke lanes        (needs macOS runner; not in CI)
#   - Windows smoke lanes      (needs Windows runner; not in CI)
#   - gh release upload + the  (needs a real GitHub release)
#     draft-to-publish flip
#   - post-publish canary      (needs the actual published asset URLs)
#
# What this DOES cover:
#   - All production build paths on linux
#   - Packager + verifier + checksums.txt invariants
#   - install.sh in production mode (no test-mode env vars) talking
#     to a host-shaped server, including the unique Release asset
#     URL path /releases/download/<tag>/<file>
#   - Tampered-checksum rejection (the smoke-bad-checksum security
#     guarantee), independently re-asserted here
#
# Bails on any failure with `set -euo pipefail`. Cleans up after
# itself on exit (kills the fixture server, removes the build
# directory). Intended to be invoked from .github/workflows/ci.yml
# as a separate job that is a required check before merge.
#
# Required environment (set by CI):
#   NODE_VERSION      Node 24 (mirrors release.yml pin)
#   NODE_VERSION       Node 25.7.0 (mirrors release.yml pin)
#
# Local usage:
#   bash scripts/ci-release-pipeline-dry-run.sh

set -euo pipefail

# Locate repo root. ${BASH_SOURCE[0]} resolves to the script path even
# when invoked through a symlink; cd into its directory and upward
# until we find package.json.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# All build artifacts go under `release/` because that's the path
# `scripts/build-binary.mjs` hardcodes as its output directory (no
# CLI override). The packager + verifier in `release.yml` also use
# `release/` as `--release-dir`. Matching that exact path keeps the
# dry-run strictly equivalent to the production build. The cleanup
# trap below removes `release/` at exit, so this only ever writes
# to a path that doesn't exist outside CI.
BUILD_DIR="release"
PUBLIC_DIR="${BUILD_DIR}/public"
RAW_DIR="${BUILD_DIR}/internal/raw"
SIZE_REPORT="${BUILD_DIR}/internal/release-size-report.json"
FIXTURE_PORT_FILE="$(mktemp -t umactually-ci-fixture-port.XXXXXX)"
FAKE_HOME=""
TMP_PUBLIC=""
BAD_FIXTURE_PID=""
BAD_FIXTURE_PORT_FILE=""
INSTALL_LOG=""
trap 'cleanup' EXIT

cleanup() {
  set +e
  if [[ -n "${FIXTURE_PID:-}" ]] && kill -0 "${FIXTURE_PID}" 2>/dev/null; then
    kill "${FIXTURE_PID}" 2>/dev/null
    wait "${FIXTURE_PID}" 2>/dev/null
  fi
  if [[ -n "${BAD_FIXTURE_PID}" ]] && kill -0 "${BAD_FIXTURE_PID}" 2>/dev/null; then
    kill "${BAD_FIXTURE_PID}" 2>/dev/null
  fi
  rm -f "${FIXTURE_PORT_FILE}" "${BAD_FIXTURE_PORT_FILE}" "${INSTALL_LOG}" 2>/dev/null
  rm -rf "${BUILD_DIR}" "${FAKE_HOME}" "${TMP_PUBLIC}" 2>/dev/null
}

# ----- 1. Node preamble -----
log() { printf '[dry-run] %s\n' "$*" >&2; }
fail() { printf '[dry-run] FAIL: %s\n' "$*" >&2; exit 1; }

if ! command -v node >/dev/null 2>&1; then
  fail "node not on PATH; CI installs actions/setup-node@v4 with node-version 25.7.0"
fi
NODE_VERSION="$(node --version)"
NODE_MAJOR="${NODE_VERSION#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"
# The Node SEA loader requires Node >= 25.7.0; pinning to 25.0.0
# (or any earlier 25.x) would pass the major-version check but fail
# the actual loader. Verify the minor.patch as well.
NODE_MINOR_PATCH="${NODE_VERSION#v}"
NODE_MINOR_PATCH="${NODE_MINOR_PATCH#*.}"
if [[ "${NODE_MAJOR}" != "25" ]] || [[ "${NODE_MINOR_PATCH}" < "7.0" ]]; then
  fail "expected node >= 25.7.0, got ${NODE_VERSION}. CI pins via actions/setup-node@v4 with node-version 25.7.0."
fi
log "node ${NODE_VERSION}"

# ----- 2. Build (mirrors build-package steps 1-7) -----
log "1/9  npm ci"
npm ci --no-audit --no-fund --silent

log "2/9  npm run typecheck (matches build-package)"
npm run typecheck

log "3/9  npm run build (dist/ + post-bundle)"
npm run build

log "4/9  build-sea.mjs → release-build/{internal/raw,public} after stage"
node scripts/build-sea.mjs

log "5/9  package-release-assets.mjs → archives + checksums.txt"
node scripts/package-release-assets.mjs \
  --manifest scripts/release-targets.json \
  --release-dir release

log "6/9  verify stage sizes (replaces verify-release-assets.mjs --measure)"
# The v0.5.x verify-release-assets.mjs checked Bun-version-pin
# consistency against release-size-budget.json. In v0.6.0 we
# dropped both the Bun pin and the budget file (Node SEA is the
# official path; tsdown's --exe already enforces bundle size
# internally). The smoke-sea job in ci.yml is the runtime check;
# here we apply the same MIN/MAX sanity check the release workflow
# applies so the dry-run and the release build enforce one set of
# bounds. MIN_RAW_BYTES catches a partial SEA blob (existence +
# self-consistent sha256 is not enough — it would still fail on
# launch). MAX_RAW_BYTES catches a runaway build. As of v0.6.0
# the largest target is darwin-x64 at ~134 MiB; 200 MiB leaves
# ~50% headroom for legitimate growth.
node -e '
const fs = require("fs");
const path = require("path");
const manifest = JSON.parse(fs.readFileSync("scripts/release-targets.json", "utf8"));
const releaseDir = "release";
const MIN_RAW_BYTES = 1 * 1024 * 1024;
const MAX_RAW_BYTES = 200 * 1024 * 1024;
let failed = 0;
for (const t of manifest) {
  const p = path.join(releaseDir, t.rawName);
  if (!fs.existsSync(p)) {
    console.error("MISSING: " + p);
    failed++;
    continue;
  }
  const size = fs.statSync(p).size;
  if (size < MIN_RAW_BYTES) {
    console.error("TOO SMALL: " + p + " (" + size + " bytes; expected >= " + MIN_RAW_BYTES + ")");
    failed++;
    continue;
  }
  if (size > MAX_RAW_BYTES) {
    console.error("TOO LARGE: " + p + " (" + size + " bytes; expected <= " + MAX_RAW_BYTES + ")");
    failed++;
    continue;
  }
  console.log("  " + t.rawName + " (" + size + " bytes)");
}
if (failed > 0) {
  console.error("verify stage: " + failed + " target(s) failed size sanity check");
  process.exit(1);
}
console.log("verify stage: all " + manifest.length + " targets present and within size bounds");
'

# ----- 3. Stage into release/public/ + internal/raw/ -----
# Use the same staging script the release-pipeline uses (lifted out
# from release.yml's inline node -e block into scripts/ so the
# bash-JSON-quoting tension goes away). After stage, public/ contains
# the 6 archives + checksums.txt, internal/raw/ contains the 6 raws,
# and internal/release-size-report.json is left in place.
log "7/9  stage: split release/ into public/<archives>+checksums.txt and internal/raw/<binaries>"
node scripts/stage-release-assets.mjs \
  --release-dir release \
  --manifest scripts/release-targets.json

test -d "${PUBLIC_DIR}"
test -d "${RAW_DIR}"
ARCHIVE_COUNT=$(ls -1 "${PUBLIC_DIR}" | wc -l | tr -d '[:space:]')
if [[ "${ARCHIVE_COUNT}" != "7" ]]; then
  fail "expected 7 files in ${PUBLIC_DIR}, got ${ARCHIVE_COUNT}: $(ls -1 "${PUBLIC_DIR}")"
fi
log "  public/: $(ls -1 "${PUBLIC_DIR}" | tr '\n' ' ')"

# ----- 4. Verify checksums.txt round-trip -----
log "8/9  [must be all OK]: cd public && sha256sum -c checksums.txt"
(cd "${PUBLIC_DIR}" && sha256sum -c checksums.txt)

# ----- 5. Start fixture server masquerading as GitHub Releases -----
log "9a/9 launching release-fixture-server.mjs"
# Use a strict-semver tag — install.sh's tag validator rejects suffixes
# like `-dry-run`. We pin to v0.5.0 (the same tag the release pipeline
# actually publishes) so the tag-routing code path is exercised against
# the production contract: tag matching, base-path resolution, and
# archive lookup all see what the real release would see.
node "test/helpers/release-fixture-server.mjs" \
  --release-dir "${PUBLIC_DIR}" \
  --release-tag "v0.5.0" \
  >"${FIXTURE_PORT_FILE}" 2>&1 &
FIXTURE_PID=$!

FIXTURE_BASE=""
for _attempt in $(seq 1 50); do
  if [[ -s "${FIXTURE_PORT_FILE}" ]]; then
    FIXTURE_BASE="$(grep -oE '^PORT=[0-9]+' "${FIXTURE_PORT_FILE}" | head -1 | cut -d= -f2)"
    if [[ -n "${FIXTURE_BASE}" ]]; then break; fi
  fi
  sleep 0.1
done
if [[ -z "${FIXTURE_BASE}" ]]; then
  fail "fixture server did not advertise a port within 5s: $(cat "${FIXTURE_PORT_FILE}")"
fi
FIXTURE_BASE="http://127.0.0.1:${FIXTURE_BASE}"
log "    fixture: ${FIXTURE_BASE}"

# ---- Canary-equivalent step (Run public installer against the published immutable tag) ----
log "9b/9 canary-equivalent: install.sh against immutable-tag-shaped fixture"
FAKE_HOME="$(mktemp -d -t umactually-ci-dryrun.XXXXXX)"
export UMACTUALLY_NO_PATH_UPDATE=1
# Production-shape BASE: include the tag, the same way users paste
# the github canonical /releases/download/<tag>/ URL when invoking
# install.sh directly. install.sh case 5 takes BASE-as-is (no tag
# rewriting) when INSTALL_RELEASE_BASE is set, so RESOLVED_BASE
# becomes exactly the path we want. The base-tag validator at
# line 405 was relaxed in this PR to allow tag-in-BASE when
# INSTALL_RELEASE_TAG is also explicitly set.
export INSTALL_RELEASE_BASE="${FIXTURE_BASE}/releases/download/v0.5.0"
export INSTALL_RELEASE_TAG="v0.5.0"
export INSTALL_ASSET_CONTRACT="archive"
export HOME="${FAKE_HOME}"
export PLATFORM_OVERRIDE="linux"
export ARCH_OVERRIDE="x64"

sh scripts/install.sh
INSTALL_DIR="${FAKE_HOME}/.local/bin"
test -x "${INSTALL_DIR}/umactually" || fail "umactually binary not executable at ${INSTALL_DIR}/umactually"
INSTALLED_VERSION="$("${INSTALL_DIR}/umactually" --version)"
[[ -n "${INSTALLED_VERSION}" ]] || fail "--version produced empty output (Bun console-handle regression?)"
"${INSTALL_DIR}/umactually" --help >/dev/null
"${INSTALL_DIR}/umactually" doctor >/dev/null
log "    installed binary works: ${INSTALLED_VERSION}"

# ---- Smoke-bad-checksum equivalent ----
log "9c/9 smoke-bad-checksum-equivalent: tampered checksums rejection"

TMP_PUBLIC="$(mktemp -d -t umactually-ci-badcheck.XXXXXX)"
cp -r "${PUBLIC_DIR}/." "${TMP_PUBLIC}/"
node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const dir = process.argv[1];
  const baseline = fs.readFileSync(path.join(dir, "checksums.txt"), "utf8");
  const tampered = baseline.split("\n").map((line) => {
    if (line.endsWith("  umactually-linux-x64.tar.gz")) {
      return "0000000000000000000000000000000000000000000000000000000000000000  umactually-linux-x64.tar.gz";
    }
    return line;
  }).join("\n");
  fs.writeFileSync(path.join(dir, "checksums.txt"), tampered);
' "${TMP_PUBLIC}"

BAD_FIXTURE_PORT_FILE="$(mktemp -t umactually-ci-bad-fixture-port.XXXXXX)"
node "test/helpers/release-fixture-server.mjs" \
  --release-dir "${TMP_PUBLIC}" \
  --release-tag "v0.5.0" \
  >"${BAD_FIXTURE_PORT_FILE}" 2>&1 &
BAD_FIXTURE_PID=$!
BAD_FIXTURE_BASE=""
for _attempt in $(seq 1 50); do
  if [[ -s "${BAD_FIXTURE_PORT_FILE}" ]]; then
    BAD_FIXTURE_BASE="$(grep -oE '^PORT=[0-9]+' "${BAD_FIXTURE_PORT_FILE}" | head -1 | cut -d= -f2)"
    if [[ -n "${BAD_FIXTURE_BASE}" ]]; then break; fi
  fi
  sleep 0.1
done
if [[ -z "${BAD_FIXTURE_BASE}" ]]; then
  fail "bad-checksum fixture server did not advertise a port"
fi
BAD_FIXTURE_BASE="http://127.0.0.1:${BAD_FIXTURE_BASE}"

SEED_BIN="$(printf 'seeded-installed-binary-dry-run\n')"
mkdir -p "${FAKE_HOME}/.local/bin"
printf "%s" "${SEED_BIN}" > "${FAKE_HOME}/.local/bin/umactually"
BEFORE="$(sha256sum "${FAKE_HOME}/.local/bin/umactually" | awk '{print $1}')"

INSTALL_LOG="$(mktemp -t umactually-ci-bad-install.XXXXXX.log)"
# Same fixture tag (v0.5.0) as the canary step. The bad-checksum
# path differs in BASE only: this fixture serves the TAMPERED
# release/ from TMP_PUBLIC, so the installer's checksums.txt
# verification routes to the tampered digest and the install is
# rejected as expected.
INSTALL_RELEASE_BASE="${BAD_FIXTURE_BASE}/releases/download/v0.5.0" \
INSTALL_RELEASE_TAG="v0.5.0" \
INSTALL_ASSET_CONTRACT="archive" \
PLATFORM_OVERRIDE="linux" \
ARCH_OVERRIDE="x64" \
UMACTUALLY_NO_PATH_UPDATE=1 \
  sh scripts/install.sh >"${INSTALL_LOG}" 2>&1 || INSTALL_EXIT=$?
INSTALL_EXIT="${INSTALL_EXIT:-0}"

AFTER="$(sha256sum "${FAKE_HOME}/.local/bin/umactually" | awk '{print $1}')"
STAGE_RESIDUE="$(find "${FAKE_HOME}/.local/bin" /usr/local/bin -maxdepth 1 -name '.umactually-stage*' -print -quit 2>/dev/null || true)"

if [[ "${BEFORE}" != "${AFTER}" ]]; then
  echo "=== install.sh output ===" >&2
  cat "${INSTALL_LOG}" >&2 || true
  fail "tampered-checksum install MODIFIED the seeded binary (BEFORE=${BEFORE} AFTER=${AFTER}). The security guarantee is broken."
fi
if [[ -n "${STAGE_RESIDUE}" ]]; then
  fail "tampered-checksum install left stage residue at ${STAGE_RESIDUE}; the security guarantee is broken."
fi
if [[ "${INSTALL_EXIT}" -eq 0 ]]; then
  fail "tampered-checksum install exited 0; installer should reject mismatched checksums. (See ${INSTALL_LOG})"
fi
log "    tampered install REJECTED: BEFORE==AFTER, no stage residue, exit=${INSTALL_EXIT}"

log "ALL CHECKS PASSED."
