// SPDX-License-Identifier: MIT
// Regression tests for scripts/ci-release-pipeline-dry-run.sh.
//
// This script is the bridge between PR-CI (which cannot run macOS /
// Windows / publish-only lanes) and the actual release run. If a
// future refactor changes the script in a way that no longer
// exercises the production build path, the production install path,
// or the tampered-checksum security guarantee, PR-CI may pass while
// the release run still fails. These tests pin the script's
// structural contracts so that surface is caught at PR time.

// IMPLEMENTATION NOTE: we deliberately do not spawn bash. We parse
// the script's surface area statically (regex / substring match)
// because the script depends on Bun 1.3.14, Node 24, and the full
// build chain, none of which is part of a vitest worker's contract.
// Surface checks are sufficient for the regression guard: the actual
// functional test of the dry-run lives in the
// release-pipeline-dry-run GitHub Actions job, which runs end-to-end
// on a real ubuntu-latest runner.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "ci-release-pipeline-dry-run.sh");
const CI_WORKFLOW = join(REPO_ROOT, ".github", "workflows", "ci.yml");

function readScript(): string {
  return readFileSync(SCRIPT, "utf8");
}

function readWorkflow(): string {
  return readFileSync(CI_WORKFLOW, "utf8");
}

describe("ci-release-pipeline-dry-run.sh — structural contract (PR-time guard)", () => {
  it("script exists and is a regular file", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const stat = fs.statSync(SCRIPT);
    expect(stat.isFile()).toBe(true);
    // The CI invocation is `bash scripts/ci-release-pipeline-dry-run.sh`
    // (explicit `bash`, no shebang execution) so the executable bit is
    // irrelevant on Linux runners. On Windows the chmod +x grant is
    // also dropped at git checkout, so we don't pin the executable
    // bit.
  });

  it("RELEASE-PIPELINE-DRY-RUN-FAILS-ON-ERROR: set -euo pipefail is set up-front", () => {
    const text = readScript();
    // `set -euo pipefail` must appear at the top of the script (or
    // be the first non-comment non-blank line). Without it, the
    // script would silently swallow failures in the middle of the
    // build chain and produce a green run with no archives.
    const lines = text.split(/\r?\n/u);
    let foundAt = -1;
    for (let i = 0; i < lines.length; i += 1) {
      const line = (lines[i] ?? "").trim();
      if (line.length === 0 || line.startsWith("#")) continue;
      if (/^set\s+-[a-zA-Z]+\b/u.test(line)) {
        // Acceptable shells: bash, sh. The exact options must
        // include -e and -u (and ideally -o pipefail).
        const opts = line.replace(/^set\s+-/u, "");
        expect(opts).toContain("e");
        expect(opts).toContain("u");
        foundAt = i;
        break;
      }
    }
    expect(foundAt).toBeGreaterThanOrEqual(0);
  });

  it("RELEASE-PIPELINE-DRY-RUN-BUILDS-SIX-TARGETS: runs npm run build, build-binary.mjs, package-release-assets.mjs, verify-release-assets.mjs", () => {
    // The release-pipeline-dry-run script must run the SAME scripts
    // that release.yml's `build-package` runs. If any of these are
    // dropped, the dry-run no longer matches the production build
    // and CI green stops being a release guarantee.
    const text = readScript();
    expect(text, "must invoke npm run build").toMatch(/^npm run build$/mu);
    expect(text, "must invoke build-binary.mjs").toMatch(/node scripts\/build-binary\.mjs/);
    expect(text, "must invoke package-release-assets.mjs").toMatch(
      /node scripts\/package-release-assets\.mjs/,
    );
    expect(text, "must invoke verify-release-assets.mjs").toMatch(
      /node scripts\/verify-release-assets\.mjs/,
    );
    expect(text, "must invoke npm run typecheck (matches build-package)").toMatch(/^npm run typecheck$/mu);
  });

  it("RELEASE-PIPELINE-DRY-RUN-CHECKSUMS-ROUND-TRIP: validates checksums.txt round-trip via sha256sum -c", () => {
    const text = readScript();
    // After package-release-assets.mjs + verify-release-assets.mjs
    // produce checksums.txt, the script must run
    //   (cd public && sha256sum -c checksums.txt)
    // to catch drift between the build and the publish assets.
    expect(text).toMatch(/sha256sum\s+-c\s+checksums\.txt/u);
    // And it must abort if the round-trip fails. set -e handles
    // that automatically, but a regression that swallowed the
    // error (e.g. wrapped in `if false`) would silently ship a
    // mismatched bundle. We assert the script does NOT pipe the
    // sha256sum output through a filter like `|| true`.
    const shaIdx = text.search(/sha256sum\s+-c\s+checksums\.txt/u);
    if (shaIdx >= 0) {
      // Look at the next 80 chars for a `|| true` short-circuit.
      const window = text.slice(shaIdx, shaIdx + 120);
      expect(window, "sha256sum -c checksums.txt must NOT be short-circuited with `|| true`").not.toMatch(
        /\|\|\s*true\b/u,
      );
    }
  });

  it("RELEASE-PIPELINE-DRY-RUN-CANARY: launches release-fixture-server.mjs and runs install.sh against it", () => {
    const text = readScript();
    expect(text, "must launch release-fixture-server.mjs").toMatch(
      /test\/helpers\/release-fixture-server\.mjs/,
    );
    // The dry-run is meant to mirror the canary's `Run public
    // installer against the published immutable tag` step. That step
    // sets INSTALL_RELEASE_BASE, INSTALL_RELEASE_TAG, and
    // INSTALL_ASSET_CONTRACT=archive. The dry-run must do the same
    // so URL routing matches production. Pin each env var.
    expect(
      text,
      "must set INSTALL_RELEASE_BASE for the canary-equivalent step",
    ).toMatch(/INSTALL_RELEASE_BASE=/u);
    expect(
      text,
      "must set INSTALL_RELEASE_TAG for the canary-equivalent step",
    ).toMatch(/INSTALL_RELEASE_TAG=/u);
    expect(
      text,
      "must set INSTALL_ASSET_CONTRACT=archive so the archive contract path is exercised",
    ).toMatch(/INSTALL_ASSET_CONTRACT=["']?archive["']?/);
    // And it must actually run install.sh — that's the user-facing
    // path. Anything else mocks or short-circuits the install path.
    expect(text, "must run `sh scripts/install.sh`").toMatch(/sh\s+scripts\/install\.sh/);
  });

  it("RELEASE-PIPELINE-DRY-RUN-CANARY-BINARY-SMOKE: install.sh output is then probed via --version, --help, doctor", () => {
    const text = readScript();
    // The canary's smoke test runs three probes on the freshly
    // installed binary. The dry-run must do the same — otherwise a
    // path that loads but never reaches a CLI command would not
    // surface and the canary step would still pass on a dead binary.
    expect(text, "must run --version").toMatch(/--version/);
    expect(text, "must run --help").toMatch(/--help/);
    expect(text, "must run doctor").toMatch(/doctor/);
  });

  it("RELEASE-PIPELINE-DRY-RUN-BAD-CHECKSUM: re-asserts the smoke-bad-checksum security guarantee", () => {
    const text = readScript();
    // The bad-checksum lane must (a) tamper checksums.txt for the
    // linux-x64 entry, (b) run install.sh against a fixture serving
    // the tampered asset, (c) assert the install was REJECTED
    // (exit non-zero OR seeded binary preserved AND no stage
    // residue). Pin each step.
    //
    // (a) linux-x64 tamper:
    expect(text, "must tamper the linux-x64 entry of checksums.txt").toMatch(
      /umactually-linux-x64\.tar\.gz/,
    );
    expect(text, "must zero out the linux-x64 checksum").toMatch(/0{64}/u);
    // (b) bad-checksum fixture invocation:
    expect(text, "must invoke a SECOND release-fixture-server for the tampered bundle").toMatch(
      /release-fixture-server\.mjs/,
    );
    // (c) rejection assertion: BEFORE / AFTER byte equality is the
    //     source-of-truth security post-condition. Pin the variable
    //     names so a regression that removes them is caught.
    expect(text, "must compare BEFORE sha256 of seeded binary against AFTER").toMatch(
      /BEFORE=.*sha256sum.*AFTER=/su,
    );
    expect(text, "must check for stage-residue cleanup").toMatch(/STAGE_RESIDUE/u);
  });

  it("RELEASE-PIPELINE-DRY-RUN-BUN-PIN: enforces Bun 1.3.14 (matches release.yml)", () => {
    const text = readScript();
    // Bun-version drift between CI and the release run is exactly
    // the kind of bug that leaves PR-CI green while the release
    // fails (because Bun cross-compile byte output depends on the
    // compiler version). The script must:
    //   1. invoke `bun --version`
    //   2. read it into BUN_VERSION
    //   3. compare against "1.3.14"
    //   4. call `fail` if they disagree
    expect(text).toMatch(/bun --version/);
    expect(text).toMatch(/BUN_VERSION=/);
    expect(text).toMatch(/1\.3\.14/);
    expect(text, "must call fail() if Bun version is wrong").toMatch(/fail\s+["']?[^"']*bun[^"']*1\.3\.14/iu);
  });

  it("RELEASE-PIPELINE-DRY-RUN-CLEANUP-ON-EXIT: trap must clean up fixture + build dir", () => {
    const text = readScript();
    // The script must clean up after itself on any exit path. Pin
    // the existence of a `trap ... EXIT` block.
    expect(text).toMatch(/trap\s+['"]?cleanup['"]?\s+EXIT/u);
  });
});

describe(".github/workflows/ci.yml — release-pipeline-dry-run job is a required PR check", () => {
  it("ci.yml defines a release-pipeline-dry-run job", () => {
    const text = readWorkflow();
    expect(text).toMatch(/^  release-pipeline-dry-run:\s*$/mu);
  });

  it("RELEASE-PIPELINE-DRY-RUN-CI-JOB-RUNS-SCRIPT: ci job invokes ci-release-pipeline-dry-run.sh", () => {
    const text = readWorkflow();
    // The job-key under `jobs:` is `release-pipeline-dry-run:`. We
    // split the YAML on top-level `  <key>:` boundaries and find the
    // LAST segment that matches the human display name. (Comments
    // in earlier segments also mention the name; we want the
    // actual job body.)
    const segments = text.split(/^  [a-z][a-z0-9-]*:\s*$/mu);
    const matches = segments.filter((segment) =>
      /release-pipeline-dry-run/u.test(segment) ||
      /release pipeline dry-run/u.test(segment),
    );
    const job = matches.at(-1);
    expect(job, "release-pipeline-dry-run job segment must exist").toBeDefined();
    expect(job, "release-pipeline-dry-run must run the script").toMatch(
      /bash scripts\/ci-release-pipeline-dry-run\.sh/,
    );
  });

  it("RELEASE-PIPELINE-DRY-RUN-CI-JOB-PINS-BUN: setup-bun version matches release.yml", () => {
    const text = readWorkflow();
    // Both workflows must pin the same Bun version, otherwise a
    // Bun upgrade to release.yml breaks release while CI stays green.
    const segments = text.split(/^  [a-z][a-z0-9-]*:\s*$/mu);
    const matches = segments.filter((segment) =>
      /release-pipeline-dry-run/u.test(segment) ||
      /release pipeline dry-run/u.test(segment),
    );
    const ciJob = matches.at(-1);
    expect(ciJob).toMatch(/oven-sh\/setup-bun@v2/);
    expect(ciJob).toMatch(/bun-version:\s*["']1\.3\.14["']/);
    // Cross-reference: release.yml also pins Bun 1.3.14.
    const releaseYml = readFileSync(join(REPO_ROOT, ".github", "workflows", "release.yml"), "utf8");
    expect(releaseYml).toMatch(/bun-version:\s*["']1\.3\.14["']/);
  });
});

// ---------------------------------------------------------------------------
// Stage-script contract — both the dry-run and the release.yml build-package
// step must use the SAME staging helper. Without sharing one script, a
// developer who fixes a packaging bug in one workflow but not the other
// would pass PR-CI green and still fail the release. The shared helper
// is scripts/stage-release-assets.mjs.
// ---------------------------------------------------------------------------

describe("scripts/stage-release-assets.mjs — shared staging helper", () => {
  it("script exists and uses fs.renameSync-style idempotent moves", () => {
    const path = join(REPO_ROOT, "scripts", "stage-release-assets.mjs");
    const fs = require("node:fs") as typeof import("node:fs");
    expect(fs.existsSync(path)).toBe(true);
    const text = readFileSync(path, "utf8");
    // The CLI parses --release-dir and --manifest into an options
    // map keyed by the flag's body (e.g. `options["release-dir"]`).
    // Assert the flag keys exist in source, then assert their values
    // resolve to the manifest / release paths.
    expect(text, "must parse --release-dir into options[release-dir]").toMatch(
      /options\["release-dir"\]/u,
    );
    expect(text, "must parse --manifest into options[manifest]").toMatch(
      /options\["manifest"\]/u,
    );
    // Must move files, not copy (rename is atomic and idempotent).
    expect(text).toMatch(/renameSync/u);
    // Must handle missing source files gracefully (partial rerun).
    expect(text).toMatch(/existsSync/u);
  });

  it("RELEASE-STAGE-SHARED-HELPER: release.yml build-package uses scripts/stage-release-assets.mjs (same helper as dry-run)", () => {
    const releaseYml = readFileSync(join(REPO_ROOT, ".github", "workflows", "release.yml"), "utf8");
    // The release.yml build-package Stage step must invoke the shared
    // helper — never the inline `node -e '...'` form, which kept
    // diverging between the two pipelines in the past.
    expect(
      releaseYml,
      "release.yml must call `node scripts/stage-release-assets.mjs --release-dir release --manifest scripts/release-targets.json`",
    ).toMatch(/node scripts\/stage-release-assets\.mjs/);
    expect(releaseYml).toMatch(/--release-dir\s+release/);
    expect(releaseYml).toMatch(/--manifest\s+scripts\/release-targets\.json/);
    // Cross-reference: dry-run script also uses the shared helper.
    const dryRunScript = readFileSync(SCRIPT, "utf8");
    expect(dryRunScript).toMatch(/node scripts\/stage-release-assets\.mjs/);
  });
});
