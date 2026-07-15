#!/bin/sh
# SPDX-License-Identifier: MIT
# Uninstaller for umactually standalone binary.
# Removes the binary and cleans up PATH entries from shell configs.
#
# Usage:
#   curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/uninstall.sh | sh
#
# Test mode (used by test/unit/install-scripts.test.ts):
#   UNINSTALL_TEST_MODE=1 UNINSTALL_TEST_DIR=/tmp/xyz ./uninstall.sh
#     - operates on UNINSTALL_TEST_DIR instead of ~/.local/bin
#     - returns exit 0 with a JSON-like summary

set -e

# Test-mode path
if [ "${UNINSTALL_TEST_MODE:-0}" = "1" ]; then
  TEST_DIR="${UNINSTALL_TEST_DIR:-${HOME}/.local/bin}"
  FOUND=0
  REMOVED=0
  if [ -f "${TEST_DIR}/umactually" ]; then
    FOUND=1
    rm -f "${TEST_DIR}/umactually"
    REMOVED=1
  fi
  echo "TEST_MODE=1"
  echo "TEST_DIR=${TEST_DIR}"
  echo "FOUND=${FOUND}"
  echo "REMOVED=${REMOVED}"
  exit 0
fi

# Production path: find and remove the binary
for dir in "${HOME}/.local/bin" "/usr/local/bin"; do
  if [ -f "${dir}/umactually" ]; then
    rm -f "${dir}/umactually"
    echo "Removed ${dir}/umactually"
  fi
done

# Clean up PATH entries from shell configs
for rcfile in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
  if [ -f "$rcfile" ]; then
    if grep -q "# Added by umactually installer" "$rcfile" 2>/dev/null; then
      sed -i.tmp '/^$/N;/# Added by umactually installer\nexport PATH/d' "$rcfile" 2>/dev/null || \
        sed -i '' '/^$/N;/# Added by umactually installer\nexport PATH/d' "$rcfile" 2>/dev/null || true
      rm -f "${rcfile}.tmp" 2>/dev/null || true
    fi
  fi
done

# Check if anything remains
if command -v umactually >/dev/null 2>&1; then
  echo ""
  echo "Warning: 'umactually' is still on your PATH at: $(command -v umactually)"
  echo "This may be an npm global install. Run: npm uninstall -g umactually"
else
  echo ""
  echo "umactually has been removed."
fi