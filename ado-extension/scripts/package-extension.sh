#!/usr/bin/env bash
#
# Build and package the UmActually ADO extension into a .vsix.
#
# Usage:
#   bash scripts/package-extension.sh                       # build the .vsix
#   bash scripts/package-extension.sh --rev-version        # also bump patch version
#   bash scripts/package-extension.sh --publisher <id>     # set publisher in manifest
#   bash scripts/package-extension.sh --share <org>        # share with an org (sideload)
#
# IN DEVELOPMENT: this script has not been tested end-to-end against
# a real Marketplace publisher ID. The first real sideload will
# validate the build/publish path. See ../README.md for the
# pre-publish checklist.
#
# Prerequisites:
#   - Node 20+
#   - npm i -g tfx-cli   (Microsoft's extension packager)
#   - For --share: an ADO PAT with "Marketplace (publish)" scope
#   - For --publish: a registered Visual Studio Marketplace publisher

set -euo pipefail

# Resolve script directory and the parent (ado-extension/) directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${EXT_DIR}"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

REV_VERSION=false
PUBLISHER_ID=""
SHARE_ORG=""
PUBLISH=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rev-version)
      REV_VERSION=true
      shift
      ;;
    --publisher)
      PUBLISHER_ID="$2"
      shift 2
      ;;
    --share)
      SHARE_ORG="$2"
      shift 2
      ;;
    --publish)
      PUBLISH=true
      shift
      ;;
    -h|--help)
      sed -n '2,30p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

if ! command -v tfx >/dev/null 2>&1; then
  echo "ERROR: tfx-cli is not installed. Install with: npm i -g tfx-cli" >&2
  exit 1
fi

if ! command -v tsc >/dev/null 2>&1 && ! command -v npx >/dev/null 2>&1; then
  echo "ERROR: TypeScript is not installed. Install with: npm i -g typescript" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 1: build the task TypeScript into index.js
# ---------------------------------------------------------------------------

echo "==> Building ReviewTask/index.ts -> ReviewTask/index.js"
cd "${EXT_DIR}/ReviewTask"

if [[ ! -d node_modules ]]; then
  echo "    Installing task dependencies (azure-pipelines-task-lib)..."
  npm install --no-audit --no-fund --loglevel=error
fi

npx tsc -p tsconfig.json

if [[ ! -f index.js ]]; then
  echo "ERROR: tsc did not produce index.js" >&2
  exit 1
fi
echo "    Build OK ($(wc -c < index.js) bytes)"

cd "${EXT_DIR}"

# ---------------------------------------------------------------------------
# Step 2: patch the publisher ID if --publisher was given
# ---------------------------------------------------------------------------

if [[ -n "${PUBLISHER_ID}" ]]; then
  echo "==> Setting publisher ID in vss-extension.json: ${PUBLISHER_ID}"
  # Use a portable in-place sed (BSD/GNU compatible).
  if sed --version >/dev/null 2>&1; then
    sed -i "s/REPLACE_WITH_PUBLISHER_ID/${PUBLISHER_ID}/" vss-extension.json
  else
    sed -i '' "s/REPLACE_WITH_PUBLISHER_ID/${PUBLISHER_ID}/" vss-extension.json
  fi
fi

# ---------------------------------------------------------------------------
# Step 3: generate a fresh task GUID if the placeholder is still there
# ---------------------------------------------------------------------------

if grep -q REPLACE_WITH_GENERATED_GUID ReviewTask/task.json; then
  if command -v uuidgen >/dev/null 2>&1; then
    NEW_GUID="$(uuidgen | tr 'A-Z' 'a-z')"
  elif command -v python >/dev/null 2>&1; then
    NEW_GUID="$(python -c 'import uuid; print(uuid.uuid4())')"
  else
    echo "ERROR: REPLACE_WITH_GENERATED_GUID still in ReviewTask/task.json" >&2
    echo "       and no uuidgen / python is available to generate one." >&2
    exit 1
  fi
  echo "==> Generated fresh task GUID: ${NEW_GUID}"
  if sed --version >/dev/null 2>&1; then
    sed -i "s/REPLACE_WITH_GENERATED_GUID/${NEW_GUID}/" ReviewTask/task.json
  else
    sed -i '' "s/REPLACE_WITH_GENERATED_GUID/${NEW_GUID}/" ReviewTask/task.json
  fi
fi

# ---------------------------------------------------------------------------
# Step 4: package the .vsix
# ---------------------------------------------------------------------------

echo "==> Packaging .vsix"
TFX_ARGS=(
  extension
  create
  --manifest-globs vss-extension.json
  --output "$(pwd)/dist"
)

if [[ "${REV_VERSION}" == "true" ]]; then
  TFX_ARGS+=(--rev-version)
fi

mkdir -p dist
tfx "${TFX_ARGS[@]}"

VSIX_PATH="$(ls -1t dist/*.vsix | head -1)"
echo "==> Built: ${VSIX_PATH}"

# ---------------------------------------------------------------------------
# Step 5: optional --share (sideload) or --publish
# ---------------------------------------------------------------------------

if [[ -n "${SHARE_ORG}" ]]; then
  echo "==> Sharing ${VSIX_PATH} with org: ${SHARE_ORG}"
  tfx extension share \
    --vsix "${VSIX_PATH}" \
    --share-with "${SHARE_ORG}" \
    --token "${AZURE_DEVOPS_PAT:-${ADO_PAT:-}}"
  echo "    Done. Install via Organization Settings → Extensions → Shared."
fi

if [[ "${PUBLISH}" == "true" ]]; then
  if [[ -z "${MARKETPLACE_PAT:-}" ]]; then
    echo "ERROR: --publish requires MARKETPLACE_PAT env var" >&2
    echo "       Generate at https://marketplace.visualstudio.com/manage/createpublisher" >&2
    exit 1
  fi
  echo "==> Publishing ${VSIX_PATH} to the Visual Studio Marketplace"
  tfx extension publish \
    --vsix "${VSIX_PATH}" \
    --token "${MARKETPLACE_PAT}"
  echo "    Done. The extension will be visible after Microsoft's automated review."
fi

echo "==> Done."
