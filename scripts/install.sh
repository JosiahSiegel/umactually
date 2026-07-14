#!/bin/sh
# SPDX-License-Identifier: MIT
# Universal installer for umactually standalone binary.
# Works on Linux and macOS. For Windows, use install.ps1.
#
# Usage:
#   curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh
#
# Test mode (used by test/unit/install-scripts.test.ts):
#   INSTALL_TEST_MODE=1 INSTALL_TEST_DIR=/tmp/xyz PLATFORM_OVERRIDE=darwin ARCH_OVERRIDE=arm64 ./install.sh
#     - skips the network download
#     - writes a fake stub binary to INSTALL_TEST_DIR
#     - prints a summary on stdout

set -e

REPO="JosiahSiegel/umactually"
URL_BASE="https://github.com/${REPO}/releases/latest/download"

detect_platform() {
  case "$(uname -s)" in
    Linux*)           echo "linux" ;;
    Darwin*)          echo "darwin" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;  # Git Bash etc. on Windows
    *)                echo ""; return 1 ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64)  echo "x64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) echo ""; return 1 ;;
  esac
}

# Test-mode path: no network, no real install, prints summary.
if [ "${INSTALL_TEST_MODE:-0}" = "1" ]; then
  INSTALL_DIR="${INSTALL_TEST_DIR:-${HOME}/.local/bin}"
  mkdir -p "$INSTALL_DIR"
  PLATFORM="${PLATFORM_OVERRIDE:-$(detect_platform)}"
  ARCH="${ARCH_OVERRIDE:-$(detect_arch)}"
  # Windows release assets have a .exe suffix (Bun emits Windows PE
  # binaries as `<id>-<arch>.exe`). The other platforms use the bare
  # arch suffix without an extension. Match the release workflow's
  # actual asset naming (scripts/build-binary.mjs) so the installer
  # never 404s on a real platform.
  EXT=""
  if [ "$PLATFORM" = "windows" ]; then
    EXT=".exe"
  fi
  BINARY="umactually-${PLATFORM}-${ARCH}${EXT}"
  URL="${URL_BASE}/${BINARY}"
  cat > "${INSTALL_DIR}/umactually" <<EOF
#!/bin/sh
echo "umactually test-mode stub (${PLATFORM}-${ARCH})"
EOF
  chmod +x "${INSTALL_DIR}/umactually"
  echo "TEST_MODE=1"
  echo "INSTALL_DIR=${INSTALL_DIR}"
  echo "PLATFORM=${PLATFORM}"
  echo "ARCH=${ARCH}"
  echo "BINARY=${BINARY}"
  echo "URL=${URL}"
  exit 0
fi

# Production path
PLATFORM="$(detect_platform)" || {
  echo "Unsupported OS: $(uname -s) (use install.ps1 on Windows)" >&2
  exit 1
}
ARCH="$(detect_arch)" || {
  echo "Unsupported architecture: $(uname -m)" >&2
  exit 1
}

EXT=""
if [ "$PLATFORM" = "windows" ]; then
  EXT=".exe"
fi
BINARY="umactually-${PLATFORM}-${ARCH}${EXT}"
URL="${URL_BASE}/${BINARY}"
CHECKSUMS_URL="${URL_BASE}/checksums.txt"

if [ "$(id -u)" = "0" ]; then
  INSTALL_DIR="/usr/local/bin"
else
  INSTALL_DIR="${HOME}/.local/bin"
fi
mkdir -p "$INSTALL_DIR"

TMP_DIR="$(mktemp -d 2>/dev/null)" || {
  echo "Error: could not create temporary download directory" >&2
  exit 1
}
trap 'rm -rf "$TMP_DIR"' EXIT HUP INT TERM
ASSET_PATH="${TMP_DIR}/${BINARY}"
CHECKSUMS_PATH="${TMP_DIR}/checksums.txt"

if command -v sha256sum >/dev/null 2>&1; then
  SHA256_TOOL="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  SHA256_TOOL="shasum"
else
  echo "Error: neither sha256sum nor shasum is installed; cannot verify checksum" >&2
  exit 1
fi

echo "Downloading umactually ${PLATFORM}-${ARCH}..."
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" -o "$ASSET_PATH"
  curl -fsSL "$CHECKSUMS_URL" -o "$CHECKSUMS_PATH"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$ASSET_PATH" "$URL"
  wget -qO "$CHECKSUMS_PATH" "$CHECKSUMS_URL"
else
  echo "Error: neither curl nor wget is installed" >&2
  exit 1
fi

EXPECTED_CHECKSUM="$(awk -v binary="$BINARY" '
  length($0) == 66 + length(binary) &&
    substr($0, 1, 64) ~ /^[[:xdigit:]]{64}$/ &&
    substr($0, 65, 2) == "  " &&
    substr($0, 67) == binary {
      print substr($0, 1, 64)
      matches++
    }
  END { if (matches != 1) exit 1 }
' "$CHECKSUMS_PATH")" || {
  echo "Error: checksums.txt must contain exactly one valid GNU sha256sum entry for ${BINARY}" >&2
  exit 1
}
if [ "$SHA256_TOOL" = "sha256sum" ]; then
  ACTUAL_CHECKSUM="$(sha256sum "$ASSET_PATH" | awk '{ print $1 }')"
else
  ACTUAL_CHECKSUM="$(shasum -a 256 "$ASSET_PATH" | awk '{ print $1 }')"
fi
if [ "$ACTUAL_CHECKSUM" != "$EXPECTED_CHECKSUM" ]; then
  echo "Error: checksum verification failed for ${BINARY}" >&2
  exit 1
fi

chmod +x "$ASSET_PATH"
mv "$ASSET_PATH" "${INSTALL_DIR}/umactually"

case ":$PATH:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    ADDED_PATH=true
    for rcfile in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
      if [ -f "$rcfile" ]; then
        grep -q "${INSTALL_DIR}" "$rcfile" 2>/dev/null || {
          echo "" >> "$rcfile"
          echo "# Added by umactually installer" >> "$rcfile"
          echo "export PATH=\"${INSTALL_DIR}:\$PATH\"" >> "$rcfile"
        }
        break
      fi
    done
    ;;
esac

echo ""
echo "Installed umactually to ${INSTALL_DIR}/umactually"
echo ""
echo "  ${INSTALL_DIR}/umactually --version"

if [ "${ADDED_PATH:-}" = "true" ]; then
  echo ""
  echo "NOTE: ${INSTALL_DIR} was added to your PATH in your shell config."
  echo "Restart your terminal (or run: source ~/.zshrc / ~/.bashrc) to use 'umactually' directly."
fi