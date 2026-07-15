#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Prepare the version sources for a release PR after proving the checkout is
# the canonical, clean main branch. Publishing remains a maintainer action.

set -euo pipefail

usage() {
  echo "Usage: bash scripts/release.sh [--check] <vX.Y.Z|X.Y.Z>" >&2
}

CHECK_MODE=0
if [[ "${1:-}" == "--check" ]]; then
  CHECK_MODE=1
  shift
fi

if [[ $# -ne 1 ]]; then
  usage
  exit 2
fi

TARGET_INPUT=$1
if [[ ! "$TARGET_INPUT" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "release: invalid version '$TARGET_INPUT'; expected vX.Y.Z or X.Y.Z." >&2
  exit 1
fi
TARGET_VERSION=${TARGET_INPUT#v}
TARGET_TAG="v${TARGET_VERSION}"
EXPECTED_BRANCH=${EXPECTED_RELEASE_BRANCH:-main}

command -v node >/dev/null 2>&1 || {
  echo "release: node is not on PATH. Install Node 24.x before invoking this script." >&2
  exit 127
}
command -v git >/dev/null 2>&1 || {
  echo "release: git is not on PATH." >&2
  exit 127
}

# Node reports the native OS path even under MSYS, avoiding bash pwd's argument
# translation when that path is passed back into Node for package mutation.
PACKAGE_ROOT=$(node -e 'console.log(process.cwd())')
PACKAGE_JSON="${PACKAGE_ROOT}/package.json"
CHANGELOG="${PACKAGE_ROOT}/CHANGELOG.md"

if [[ -n "$(git -C "$PACKAGE_ROOT" status --porcelain)" ]]; then
  echo "release: working tree is dirty; commit or stash changes before releasing." >&2
  exit 1
fi

CURRENT_BRANCH=$(git -C "$PACKAGE_ROOT" branch --show-current)
if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
  echo "release: current branch is '$CURRENT_BRANCH'; expected '$EXPECTED_BRANCH'." >&2
  exit 1
fi

HEAD_REV=$(git -C "$PACKAGE_ROOT" rev-parse HEAD)
if ! ORIGIN_MAIN_REV=$(git -C "$PACKAGE_ROOT" rev-parse origin/main 2>/dev/null); then
  echo "release: origin/main is unavailable; fetch origin before releasing." >&2
  exit 1
fi
if [[ "$HEAD_REV" != "$ORIGIN_MAIN_REV" ]]; then
  echo "release: HEAD does not match origin/main; update the checkout before releasing." >&2
  exit 1
fi

CURRENT_VERSION=$(node -e '
  const fs = require("node:fs");
  const packagePath = process.argv[1];
  const value = JSON.parse(fs.readFileSync(packagePath, "utf8")).version;
  if (typeof value !== "string") process.exit(1);
  process.stdout.write(value);
' "$PACKAGE_JSON")

if [[ "$CHECK_MODE" -eq 1 ]]; then
  if [[ "$CURRENT_VERSION" == "$TARGET_VERSION" ]]; then
    echo "release: current version is already ${TARGET_VERSION}." >&2
    exit 3
  fi
  if grep -Fq "## [${TARGET_VERSION}]" "$CHANGELOG"; then
    echo "release: CHANGELOG.md already contains [${TARGET_VERSION}]." >&2
    exit 1
  fi
  echo "release: ready to prepare ${TARGET_TAG} from ${EXPECTED_BRANCH}."
  exit 0
fi

# A repeated invocation after a partially prepared release must not duplicate
# the changelog entry or rewrite package metadata a second time.
if grep -Fq "## [${TARGET_VERSION}]" "$CHANGELOG"; then
  echo "release: CHANGELOG.md already contains [${TARGET_VERSION}]; no changes made."
  exit 0
fi

PACKAGE_TMP="${PACKAGE_JSON}.release.$$"
CHANGELOG_TMP="${CHANGELOG}.release.$$"
trap 'rm -f "$PACKAGE_TMP" "$CHANGELOG_TMP"' EXIT

cp "$PACKAGE_JSON" "$PACKAGE_TMP"
node -e '
  const fs = require("node:fs");
  const packagePath = process.argv[1];
  const version = process.argv[2];
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  pkg.version = version;
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
' "$PACKAGE_TMP" "$TARGET_VERSION"
mv "$PACKAGE_TMP" "$PACKAGE_JSON"

RELEASE_DATE=$(date +%Y-%m-%d)
awk -v version="$TARGET_VERSION" -v release_date="$RELEASE_DATE" '
  { print }
  $0 == "## [Unreleased]" {
    print ""
    print "## [" version "] - " release_date
    print ""
    print "### Added"
    print ""
    print "- TBD."
    print ""
    print "### Changed"
    print ""
    print "- TBD."
    print ""
    print "### Fixed"
    print ""
    print "- TBD."
    print ""
    print "### Removed"
    print ""
    print "- TBD."
    print ""
    print "### Security"
    print ""
    print "- TBD."
  }
' "$CHANGELOG" > "$CHANGELOG_TMP"
mv "$CHANGELOG_TMP" "$CHANGELOG"

if [[ "${RELEASE_TEST_MODE:-0}" != "1" ]]; then
  cd "$PACKAGE_ROOT"
  npm run render-docs
  bash scripts/ci-validate.sh
fi

cat <<EOF
release: prepared ${TARGET_TAG}.

Next steps:
  git switch -c release/${TARGET_TAG}
  git add package.json CHANGELOG.md README.md docs examples
  git commit -m "release: ${TARGET_TAG}"
  git push -u origin release/${TARGET_TAG}
  gh pr create --base main --head release/${TARGET_TAG} --title "release: ${TARGET_TAG}"
  gh pr merge --squash --delete-branch
  git switch main
  git pull --ff-only origin main
  git push ado main
  git tag -a ${TARGET_TAG} -m "release: ${TARGET_TAG} — see CHANGELOG.md for the changes"
  git push origin ${TARGET_TAG}
EOF
