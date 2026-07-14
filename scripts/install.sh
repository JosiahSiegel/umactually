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
    MINGW*|MSYS*|CYGWIN*) echo "linux" ;;  # Git Bash etc. on Windows
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
  BINARY="umactually-${PLATFORM}-${ARCH}"
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

BINARY="umactually-${PLATFORM}-${ARCH}"
URL="${URL_BASE}/${BINARY}"

if [ "$(id -u)" = "0" ]; then
  INSTALL_DIR="/usr/local/bin"
else
  INSTALL_DIR="${HOME}/.local/bin"
fi
mkdir -p "$INSTALL_DIR"

echo "Downloading umactually ${PLATFORM}-${ARCH}..."
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" -o "${INSTALL_DIR}/umactually"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "${INSTALL_DIR}/umactually" "$URL"
else
  echo "Error: neither curl nor wget is installed" >&2
  exit 1
fi

chmod +x "${INSTALL_DIR}/umactually"

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