#!/bin/sh
# SPDX-License-Identifier: MIT
# Universal installer for umactually standalone binary.
#
# Supports Linux, macOS, and Windows under Git Bash (delegates to PowerShell).
# Default flow downloads a legacy raw executable (matches pre-archive releases
# v0.2.1..v0.4.1 and the existing install-checksum test fixture). When any of
# INSTALL_RELEASE_TAG, INSTALL_RELEASE_BASE, INSTALL_ASSET_CONTRACT, or
# INSTALL_TEST_FAKE_TAG is supplied, the eight-case override matrix takes over
# and dispatches into the archive flow (for non-legacy tags) or the legacy raw
# flow (for the four legacy allowlist tags).
#
# Usage:
#   curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh
#
# Test modes:
#   INSTALL_TEST_MODE=1 INSTALL_TEST_DIR=/tmp/xyz PLATFORM_OVERRIDE=darwin ARCH_OVERRIDE=arm64 ./install.sh
#     - skips the network download
#     - writes a fake stub binary to INSTALL_TEST_DIR
#     - prints a summary on stdout
#
# Override matrix env vars (see plan section "Install scripts"):
#   INSTALL_RELEASE_TAG          Strict semver tag (vMAJOR.MINOR.PATCH)
#   INSTALL_RELEASE_BASE         Immutable asset directory base URL (no tag)
#   INSTALL_ASSET_CONTRACT       archive | legacy
#   INSTALL_TEST_FAKE_TAG        Test-mode tag override (alias of INSTALL_RELEASE_TAG)
#   INSTALL_TEST_FAKE_SERVER     Test-mode base URL override (alias of INSTALL_RELEASE_BASE)
#   INSTALL_TEST_FAKE_LATEST_URL Test-mode override of the GitHub /releases/latest URL
#   INSTALL_GITHUB_API_BASE      Production override of the GitHub /releases/latest URL
#   INSTALL_POWERSHELL_SCRIPT_URL Windows Git Bash: location of install.ps1 to fetch
#   INSTALL_MANIFEST             Reserved for future manifest-driven installer (unused)
#   INSTALL_TEST_TARBALL         Reserved
#   INSTALL_TEST_CHECKSUMS       Reserved
#   INSTALL_TEST_BASENAME        Reserved
#   INSTALL_TEST_MEMBER          Reserved
#   INSTALL_TEST_NO_SMOKE        If non-empty, skip the staged --version smoke test
#   UMACTUALLY_NO_PATH_UPDATE    If non-empty, skip shell rc PATH update
#
# Eight-case override matrix dispatch (mirrors scripts/install.ps1):
#   1. No overrides => IF INSTALL_TEST_FAKE_LATEST_URL or INSTALL_GITHUB_API_BASE
#      is set, resolve from that GitHub /releases/latest endpoint; else fall back
#      to legacy raw download (default production flow).
#   2. Tag only => use default GitHub base, infer contract from tag.
#   3. Base only => probe the supplied base's checksums.txt; if first basename
#      is a raw basename, accept legacy; otherwise reject.
#   4. Contract only => reject.
#   5. Base + tag => use supplied base, infer contract from tag.
#   6. Base + tag + contract => use supplied base/tag/contract (validate value).
#   7. Base + contract without tag => reject.
#   8. INSTALL_POWERSHELL_SCRIPT_URL is independent (changes only Git Bash delegation).

set -e
umask 077

# ---- constants ----
REPO="JosiahSiegel/umactually"
URL_BASE="https://github.com/${REPO}/releases/latest/download"
LATEST_API="https://api.github.com/repos/${REPO}/releases/latest"
LEGACY_TAG_ALLOWLIST="v0.2.1 v0.3.0 v0.4.0 v0.4.1"
MAX_EXTRACTED_BYTES=150000000

# Canonical six archive basenames (archive contract).
ARCHIVE_BASENAMES="umactually-linux-x64.tar.gz umactually-linux-arm64.tar.gz umactually-darwin-x64.tar.gz umactually-darwin-arm64.tar.gz umactually-windows-x64.zip umactually-windows-arm64.zip"

# Canonical six raw basenames (legacy contract).
RAW_BASENAMES="umactually-linux-x64 umactually-linux-arm64 umactually-darwin-x64 umactually-darwin-arm64 umactually-windows-x64.exe umactually-windows-arm64.exe"

# 64-character hex character class inlined in case patterns.
HEX64="[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]"

# ---- terminal output helpers ----
log_err() {
  printf 'Error: %s\n' "$1" >&2
}

# ---- capability probes ----
detect_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    printf 'sha256sum'
    return 0
  fi
  if command -v shasum >/dev/null 2>&1; then
    printf 'shasum'
    return 0
  fi
  return 1
}

sha256_file() {
  # $1 = sha tool name, $2 = path
  if [ "$1" = "sha256sum" ]; then
    sha256sum "$2" | awk '{ print $1 }'
  else
    shasum -a 256 "$2" | awk '{ print $1 }'
  fi
}

detect_curl() {
  if command -v curl >/dev/null 2>&1; then
    printf 'curl'
    return 0
  fi
  if command -v wget >/dev/null 2>&1; then
    printf 'wget'
    return 0
  fi
  return 1
}

# Capability probe: does mv accept `--` as end-of-options marker?
detect_mv_dashdash() {
  _out=$(mv --version 2>&1 || true)
  case "$_out" in
    *GNU*) return 0 ;;
    *) return 1 ;;
  esac
}

# Capability probe: does tar accept GNU-specific options?
detect_tar_flavor() {
  _out=$(tar --version 2>&1 || true)
  case "$_out" in
    *GNU*) printf 'gnu' ;;
    *) printf 'bsd' ;;
  esac
}

# Capability probe: stat for bytes-in-file (GNU: -c %s; BSD: -f %z).
detect_stat_bytes_flavor() {
  _path="$1"
  if stat -c '%s' "$_path" >/dev/null 2>&1; then
    printf 'gnu'
    return 0
  fi
  if stat -f '%z' "$_path" >/dev/null 2>&1; then
    printf 'bsd'
    return 0
  fi
  return 1
}

# Capability probe: stat for link count (GNU: -c %h; BSD: -f %l).
detect_stat_links_flavor() {
  _path="$1"
  if stat -c '%h' "$_path" >/dev/null 2>&1; then
    printf 'gnu'
    return 0
  fi
  if stat -f '%l' "$_path" >/dev/null 2>&1; then
    printf 'bsd'
    return 0
  fi
  return 1
}

# ---- platform / arch detection ----
detect_platform() {
  case "$(uname -s 2>/dev/null || printf '')" in
    Linux*)           printf 'linux' ;;
    Darwin*)          printf 'darwin' ;;
    MINGW*|MSYS*|CYGWIN*|Windows*) printf 'windows' ;;
    *)                return 1 ;;
  esac
}

detect_arch() {
  case "$(uname -m 2>/dev/null || printf '')" in
    x86_64|amd64)  printf 'x64' ;;
    aarch64|arm64) printf 'arm64' ;;
    *)                return 1 ;;
  esac
}

# ---- helpers: GNU vs BSD tar ----
tar_extract_member() {
  # $1=tarball, $2=member, $3=staging_dir, $4=flavor
  if [ "$4" = "gnu" ]; then
    tar -xzf "$1" --no-same-owner --no-same-permissions -C "$3" "$2"
  else
    tar -xzf "$1" -o -C "$3" "$2"
  fi
}

tar_list_names() {
  # $1=tarball. Output: one basename per line.
  tar -tzf "$1"
}

tar_list_long() {
  # $1=tarball. Output: one long record per member; first char is mode/type.
  tar -tvzf "$1"
}

# ---- checksum file validation ----
# Legacy raw checksum entry parser: echoes the 64-hex hash for the target
# basename on stdout, exit 0 iff exactly one well-formed entry exists.
checksum_legacy_select() {
  _file="$1"
  _target="$2"
  _count=0
  _hash=""
  while IFS= read -r _line; do
    # Strip trailing CR (already normalized but defensive).
    case "$_line" in
      *"$'\r'") _line=${_line%"$'\r'"} ;;
    esac
    # Strict grammar: 64 hex + two spaces + basename. POSIX case patterns
    # require the parameter expansion to be UNQUOTED for the var to
    # expand into the pattern; quoted forms become literal text.
    case "$_line" in
      ${HEX64}*"  "${_target})
        _count=$((_count + 1))
        _hash=$(printf '%s' "$_line" | cut -c1-64)
        ;;
    esac
  done < "$_file"
  if [ "$_count" -ne 1 ]; then
    return 1
  fi
  printf '%s\n' "$_hash"
  return 0
}

# Archive checksum file validation: returns 0 iff the file contains EXACTLY
# six canonical archive-basename lines, no malformed/duplicate/unknown/
# opposite-contract entries. Sets EXPECTED_HASH (global) for the line that
# matches $1.
checksum_archive_validate() {
  _file="$1"
  _wanted="$2"
  EXPECTED_HASH=""
  _seen_count=0
  _seen_set=" "
  while IFS= read -r _line; do
    case "$_line" in
      *"$'\r'") _line=${_line%"$'\r'"} ;;
    esac
    case "$_line" in
      "") continue ;;
    esac
    # Strict grammar: 64 hex + two spaces + basename. Quote-free var refs
    # so parameter expansion populates the pattern.
    case "$_line" in
      ${HEX64}*"  "*)
        _basename=${_line#*"  "}
        _is_archive=0
        for _a in $ARCHIVE_BASENAMES; do
          if [ "$_a" = "$_basename" ]; then
            _is_archive=1
            break
          fi
        done
        _is_raw=0
        for _r in $RAW_BASENAMES; do
          if [ "$_r" = "$_basename" ]; then
            _is_raw=1
            break
          fi
        done
        if [ "$_is_raw" = "1" ]; then
          log_err "opposite-contract checksum line rejected for archive: $_basename"
          return 1
        fi
        if [ "$_is_archive" = "0" ]; then
          log_err "unknown checksum basename for archive contract: $_basename"
          return 1
        fi
        case "$_seen_set" in
          *" $_basename "*)
            log_err "duplicate checksum entry: $_basename"
            return 1
            ;;
        esac
        _seen_set="${_seen_set}${_basename} "
        _seen_count=$((_seen_count + 1))
        if [ "$_basename" = "$_wanted" ]; then
          EXPECTED_HASH=$(printf '%s' "$_line" | cut -c1-64)
        fi
        ;;
      *)
        log_err "malformed checksum line: '$_line'"
        return 1
        ;;
    esac
  done < "$_file"
  if [ "$_seen_count" -ne 6 ]; then
    log_err "checksums file must contain exactly 6 canonical archive entries (found: $_seen_count)"
    return 1
  fi
  if [ -z "$EXPECTED_HASH" ]; then
    log_err "no checksum entry for $_wanted in checksums.txt"
    return 1
  fi
  return 0
}

# ---- normalize CRLF in checksum file ----
normalize_crlf() {
  # $1 = source path, $2 = destination path.
  tr -d '\r' < "$1" > "$2"
}

# ---- download helpers ----
http_get() {
  # $1 = URL, $2 = destination path
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$2" "$1"
  else
    log_err "neither curl nor wget is installed"
    return 1
  fi
}

# ---- tag inference from contract & legacy allowlist ----
tag_to_contract() {
  # $1 = tag. Outputs "archive" or "legacy".
  for _t in $LEGACY_TAG_ALLOWLIST; do
    if [ "$_t" = "$1" ]; then
      printf 'legacy'
      return 0
    fi
  done
  printf 'archive'
  return 0
}

# ---- HTTP fetch latest tag from GitHub API ----
fetch_latest_tag() {
  # $1 = API base URL. Echoes the resolved tag on stdout, exit 0 on success.
  _api="$1"
  _tmp=$(mktemp -t umactually-latest.XXXXXX) || return 1
  if ! http_get "$_api" "$_tmp"; then
    rm -f "$_tmp"
    return 1
  fi
  # Parse the API response as JSON with Node rather than substring matching.
  _metadata=$(node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(d.tag_name, d.draft ? "1" : "0", d.prerelease ? "1" : "0")' < "$_tmp") || {
    rm -f "$_tmp"
    return 1
  }
  set -- $_metadata
  _tag=$1
  _draft=$2
  _pre=$3
  rm -f "$_tmp"
  if [ -z "$_tag" ]; then
    return 1
  fi
  if [ "$_draft" = "true" ]; then
    log_err "refusing to install from draft release: $_tag"
    return 1
  fi
  if [ "$_pre" = "true" ]; then
    log_err "refusing to install from prerelease: $_tag (must be stable GA tag)"
    return 1
  fi
  case "$_tag" in
    v[0-9]*.[0-9]*.[0-9]*)
      printf '%s\n' "$_tag"
      return 0
      ;;
    *)
      log_err "refusing tag not matching strict semver: $_tag (must be stable GA tag)"
      return 1
      ;;
  esac
}

# ---- 8-case override matrix dispatch ----
# Sets global vars:
#   RESOLVED_TAG, RESOLVED_BASE, RESOLVED_CONTRACT, USE_LEGACY_RAW
# On reject, exits 1 with a diagnostic on stderr.
resolve_dispatch() {
  _tag=${INSTALL_RELEASE_TAG:-${INSTALL_TEST_FAKE_TAG:-}}
  _base_user=${INSTALL_RELEASE_BASE:-}
  _base_fake=${INSTALL_TEST_FAKE_SERVER:-}
  _base=$_base_user
  if [ -z "$_base" ]; then
    _base=$_base_fake
  fi
  _contract=${INSTALL_ASSET_CONTRACT:-}

  # Strip a single trailing slash from the base for consistent concatenation.
  case "$_base" in
    */) _base=${_base%/} ;;
  esac

  # Validate explicit contract value up front (case-6 helper).
  if [ -n "$_contract" ]; then
    case "$_contract" in
      archive|legacy) ;;
      *) log_err "INSTALL_ASSET_CONTRACT must be 'archive' or 'legacy' (got: '$_contract')"; exit 1 ;;
    esac
  fi

  # Validate the base URL when INSTALL_RELEASE_TAG is empty. The
  # unguarded BASE-with-tag pattern (e.g. the canary / dry-run
  # setting INSTALL_RELEASE_BASE=https://github.com/<repo>/releases/download/<tag>
  # together with INSTALL_RELEASE_TAG=<tag>) is a legitimate user
  # intent — install.sh case 5 takes BASE as-is without rewriting
  # it. Only when no INSTALL_RELEASE_TAG is supplied do we reject an
  # embedded tag, because case 3 (base-only) probes BASE/checksums.txt
  # and that would 404 if BASE already pointed at /<tag>/checksums.txt.
  if [ -n "$_base" ] && [ -z "$_tag" ]; then
    _base_path=${_base%%#*}
    _base_path=${_base_path%%\?*}
    case "$_base_path" in
      */v[0-9]*.[0-9]*.[0-9]*|*/v[0-9]*.[0-9]*.[0-9]*/)
        log_err "INSTALL_RELEASE_BASE must not include a tag when INSTALL_RELEASE_TAG is unset (got: '$_base')"
        exit 1
        ;;
    esac
  fi

  # Validate strict-semver tag shape if supplied.
  if [ -n "$_tag" ]; then
    # Match vMAJOR.MINOR.PATCH where MAJOR/MINOR/PATCH are one or more digits
    # and there are no trailing characters (rejects v0.5.0-rc1, v0.5.0+meta).
    case "$_tag" in
      v*)
        _body=${_tag#v}
        _major=${_body%%.*}
        _rest=${_body#*.}
        _minor=${_rest%%.*}
        _patch=${_rest#*.}
        case "$_major$_minor$_patch" in
          *[!0-9]*|"")
            log_err "INSTALL_RELEASE_TAG must match strict semver ^v[0-9]+\.[0-9]+\.[0-9]+\$ (got: '$_tag')"
            exit 1
            ;;
        esac
        # Reject extra dot-trailing segments (v0.5.0.1).
        case "$_patch" in
          *.*)
            log_err "INSTALL_RELEASE_TAG must match strict semver ^v[0-9]+\.[0-9]+\.[0-9]+\$ (got: '$_tag')"
            exit 1
            ;;
        esac
        ;;
      *)
        log_err "INSTALL_RELEASE_TAG must match strict semver ^v[0-9]+\.[0-9]+\.[0-9]+\$ (got: '$_tag')"
        exit 1
        ;;
    esac
  fi

  # Case dispatch (order matters; case 7 must precede case 3).
  if [ -n "$_tag" ] && [ -z "$_base" ] && [ -z "$_contract" ]; then
    # Case 2: tag only. Default base = GitHub /releases/download/<tag>.
    RESOLVED_TAG=$_tag
    if [ -n "$_base_fake" ]; then
      # INSTALL_TEST_FAKE_SERVER is a bare host; append /releases/download/<tag>.
      RESOLVED_BASE="${_base_fake}/releases/download/$_tag"
    else
      RESOLVED_BASE="https://github.com/${REPO}/releases/download/$_tag"
    fi
    RESOLVED_CONTRACT=$(tag_to_contract "$_tag")
    USE_LEGACY_RAW=0
    return 0
  fi
  if [ -n "$_tag" ] && [ -n "$_base" ] && [ -z "$_contract" ]; then
    # Case 5: base + tag. Inferred contract.
    # INSTALL_TEST_FAKE_SERVER is a bare host; INSTALL_RELEASE_BASE is already
    # the asset-directory URL. Normalize accordingly.
    RESOLVED_TAG=$_tag
    if [ -n "$_base_fake" ] && [ -z "$_base_user" ]; then
      RESOLVED_BASE="${_base_fake}/releases/download/$_tag"
    else
      RESOLVED_BASE=$_base
    fi
    RESOLVED_CONTRACT=$(tag_to_contract "$_tag")
    USE_LEGACY_RAW=0
    return 0
  fi
  if [ -n "$_tag" ] && [ -n "$_base" ] && [ -n "$_contract" ]; then
    # Case 6: base + tag + contract.
    RESOLVED_TAG=$_tag
    if [ -n "$_base_fake" ] && [ -z "$_base_user" ]; then
      RESOLVED_BASE="${_base_fake}/releases/download/$_tag"
    else
      RESOLVED_BASE=$_base
    fi
    RESOLVED_CONTRACT=$_contract
    USE_LEGACY_RAW=0
    return 0
  fi
  if [ -z "$_tag" ] && [ -n "$_base" ] && [ -n "$_contract" ]; then
    # Case 7 reject: contract without tag.
    log_err "INSTALL_ASSET_CONTRACT without INSTALL_RELEASE_TAG is invalid (case 7 reject)"
    exit 1
  fi
  if [ -z "$_tag" ] && [ -n "$_base" ] && [ -z "$_contract" ]; then
    # Case 3: base only. Probe the supplied base's checksums.txt first line.
    # For INSTALL_TEST_FAKE_SERVER (bare host), probe /<tag>/checksums.txt
    # patterns aren't relevant — INSTALL_TEST_FAKE_TAG isn't set in case 3.
    # For INSTALL_RELEASE_BASE, the user-supplied base IS the asset dir.
    _probe_base=$_base
    if [ -n "$_base_fake" ] && [ -z "$_base_user" ]; then
      # INSTALL_TEST_FAKE_SERVER is bare; the test fixture serves under
      # /releases/download/<tag>/. Without a tag, we cannot construct it.
      # Treat this as a probe failure (case 3 reject).
      _probe_base="http://127.0.0.1:1/dead"  # dead URL to force reject
    fi
    _probe_tmp=$(mktemp -t umactually-probe.XXXXXX) || {
      log_err "could not create temp file for case 3 probe"
      exit 1
    }
    if http_get "${_probe_base}/checksums.txt" "$_probe_tmp" 2>/dev/null; then
      _first=$(head -n 1 "$_probe_tmp" 2>/dev/null || printf '')
      case "$_first" in
        *"$'\r'") _first=${_first%"$'\r'"} ;;
      esac
      case "$_first" in
        *"  umactually-linux-x64"|\
*"  umactually-linux-arm64"|\
*"  umactually-darwin-x64"|\
*"  umactually-darwin-arm64"|\
*"  umactually-windows-x64.exe"|\
*"  umactually-windows-arm64.exe")
          # Probe sees raw basenames; accept legacy.
          RESOLVED_BASE=$_probe_base
          RESOLVED_CONTRACT=legacy
          USE_LEGACY_RAW=1
          rm -f "$_probe_tmp"
          return 0
          ;;
      esac
    fi
    rm -f "$_probe_tmp"
    log_err "INSTALL_RELEASE_BASE without INSTALL_RELEASE_TAG is invalid (case 3 reject)"
    exit 1
  fi
  if [ -z "$_tag" ] && [ -z "$_base" ] && [ -n "$_contract" ]; then
    # Case 4: contract only.
    log_err "INSTALL_ASSET_CONTRACT requires INSTALL_RELEASE_BASE (case 4 reject)"
    exit 1
  fi
  # Case 1: no overrides. Resolve from GitHub /releases/latest if an explicit
  # API base override is set; otherwise fall back to legacy raw download.
  if [ -n "${INSTALL_TEST_FAKE_LATEST_URL:-}" ]; then
    _resolved=$(fetch_latest_tag "$INSTALL_TEST_FAKE_LATEST_URL") || {
      log_err "could not resolve latest tag from INSTALL_TEST_FAKE_LATEST_URL"
      exit 1
    }
    RESOLVED_TAG=$_resolved
    if [ -n "$_base_fake" ]; then
      RESOLVED_BASE="${_base_fake}/releases/download/$_resolved"
    else
      RESOLVED_BASE="https://github.com/${REPO}/releases/download/$_resolved"
    fi
    RESOLVED_CONTRACT=$(tag_to_contract "$_resolved")
    USE_LEGACY_RAW=0
    return 0
  fi
  if [ -n "${INSTALL_GITHUB_API_BASE:-}" ]; then
    _resolved=$(fetch_latest_tag "$INSTALL_GITHUB_API_BASE") || {
      log_err "could not resolve latest tag from INSTALL_GITHUB_API_BASE"
      exit 1
    }
    RESOLVED_TAG=$_resolved
    RESOLVED_BASE="https://github.com/${REPO}/releases/download/$_resolved"
    RESOLVED_CONTRACT=$(tag_to_contract "$_resolved")
    USE_LEGACY_RAW=0
    return 0
  fi
  # No overrides and no API base override: legacy raw download (default).
  USE_LEGACY_RAW=1
  return 0
}

# ---- destination TOCTOU capture ----
# Capture identity of the destination file before download. Outputs three
# space-separated fields (inode-or-empty, byte-size-or-empty, mtime-or-empty).
capture_dest_identity() {
  _path="$1"
  if [ ! -e "$_path" ] && [ -L "$_path" ] || [ ! -e "$_path" ]; then
    if [ ! -e "$_path" ] && [ ! -L "$_path" ]; then
      printf '\n\n'
      return 0
    fi
  fi
  # Reject non-regular destinations up front.
  if [ -L "$_path" ]; then
    log_err "refusing to overwrite symlink destination: $_path"
    exit 1
  fi
  if [ -d "$_path" ]; then
    log_err "refusing to overwrite directory destination: $_path"
    exit 1
  fi
  # Pick whichever stat flavor works.
  if stat -c '%i %s %Y' "$_path" >/dev/null 2>&1; then
    stat -c '%i %s %Y' "$_path"
    return 0
  fi
  if stat -f '%i %z %m' "$_path" >/dev/null 2>&1; then
    stat -f '%i %z %m' "$_path"
    return 0
  fi
  printf '\n\n'
  return 0
}

assert_dest_identity_stable() {
  # $1 = path, $2 = expected identity (3 fields from capture_dest_identity).
  _path="$1"
  _expected="$2"
  # If expected was empty (no file), refuse overwrite if anything now exists.
  if [ -z "$(printf '%s' "$_expected" | head -n 1 | cut -f1 -d' ')" ] || [ -z "$_expected" ]; then
    if [ -e "$_path" ] || [ -L "$_path" ]; then
      log_err "destination appeared during install: $_path"
      exit 1
    fi
    return 0
  fi
  _current=$(capture_dest_identity "$_path")
  if [ "$_current" != "$_expected" ]; then
    log_err "destination identity changed during install: $_path"
    exit 1
  fi
  return 0
}

# ---- Windows Git Bash delegation ----
delegate_to_powershell() {
  _script_url=${INSTALL_POWERSHELL_SCRIPT_URL:-"https://github.com/${REPO}/raw/main/scripts/install.ps1"}
  _tmp_ps=$(mktemp -t umactually-install-ps1.XXXXXX) || {
    log_err "could not create temp file for install.ps1"
    exit 1
  }
  # Git Bash's `mktemp -t prefix.XXXXXX` creates a file whose name is
  # `<tmpdir>/prefix.<random>`, NOT `<tmpdir>/prefix.<random>.ps1`.
  # Windows PowerShell refuses to execute `-File` against a path whose
  # final extension is not `.ps1`, so the delegation fails with:
  #   "Processing -File '<path>' failed because the file does not have
  #    a '.ps1' extension."
  # Rename the file to guarantee the trailing `.ps1` extension on all
  # platforms without losing the random salt.
  _tmp_ps_renamed="${_tmp_ps}.ps1"
  mv "$_tmp_ps" "$_tmp_ps_renamed" || {
    log_err "could not rename temp file to .ps1 extension: $_tmp_ps"
    rm -f "$_tmp_ps"
    exit 1
  }
  _tmp_ps=$_tmp_ps_renamed
  if ! http_get "$_script_url" "$_tmp_ps"; then
    rm -f "$_tmp_ps"
    log_err "could not download install.ps1 from: $_script_url"
    exit 1
  fi
  if [ ! -s "$_tmp_ps" ]; then
    rm -f "$_tmp_ps"
    log_err "downloaded install.ps1 is empty: $_script_url"
    exit 1
  fi
  if ! command -v powershell.exe >/dev/null 2>&1; then
    rm -f "$_tmp_ps"
    log_err "powershell.exe not found on PATH; cannot delegate to PowerShell"
    exit 1
  fi
  INSTALL_POWERSHELL_SCRIPT_URL="$_script_url" \
    exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$_tmp_ps"
}

# ---- platform dispatch (POSIX vs Git Bash delegation) ----
maybe_delegate_windows() {
  # Only delegate when the resolved platform is "windows". PLATFORM_OVERRIDE
  # takes precedence over uname-s detection (PLATFORM_OVERRIDE=linux on a
  # Windows Git Bash means "treat this as Linux" — for the focused tests).
  if [ "$PLATFORM" != "windows" ]; then
    return 0
  fi
  # On Windows, only delegate when we're inside a Git Bash / MSYS shell.
  _unamestr=$(uname -s 2>/dev/null || printf '')
  case "$_unamestr" in
    MINGW*|MSYS*|CYGWIN*|Windows*)
      delegate_to_powershell
      exit 0
      ;;
    *)
      log_err "windows platform without Git Bash detected; install.ps1 must be invoked under PowerShell directly"
      exit 1
      ;;
  esac
  return 0
}

# ---- TEST_MODE 1: stub binary, no network, summary ----
if [ "${INSTALL_TEST_MODE:-0}" = "1" ]; then
  INSTALL_DIR=${INSTALL_TEST_DIR:-"${HOME}/.local/bin"}
  mkdir -p "$INSTALL_DIR"
  PLATFORM=${PLATFORM_OVERRIDE:-$(detect_platform || printf '')}
  ARCH=${ARCH_OVERRIDE:-$(detect_arch || printf '')}
  EXT=""
  if [ "$PLATFORM" = "windows" ]; then
    EXT=".exe"
  fi
  BINARY="umactually-${PLATFORM}-${ARCH}${EXT}"
  URL="${URL_BASE}/${BINARY}"
  printf '#!/bin/sh\necho "umactually test-mode stub (%s-%s)"\n' "$PLATFORM" "$ARCH" \
    > "${INSTALL_DIR}/umactually"
  chmod +x "${INSTALL_DIR}/umactually"
  printf 'TEST_MODE=1\n'
  printf 'INSTALL_DIR=%s\n' "$INSTALL_DIR"
  printf 'PLATFORM=%s\n' "$PLATFORM"
  printf 'ARCH=%s\n' "$ARCH"
  printf 'BINARY=%s\n' "$BINARY"
  printf 'URL=%s\n' "$URL"
  exit 0
fi

# ---- production entrypoint ----

# Detect platform/arch.
PLATFORM=${PLATFORM_OVERRIDE:-$(detect_platform || printf '')}
ARCH=${ARCH_OVERRIDE:-$(detect_arch || printf '')}
EXT=""
if [ "$PLATFORM" = "windows" ]; then
  EXT=".exe"
fi
RAW_BINARY="umactually-${PLATFORM}-${ARCH}${EXT}"

# When Git Bash on Windows is detected, hand off to PowerShell BEFORE the
# dispatch matrix so we never make a POSIX download on a Windows machine
# even if the user set overrides.
maybe_delegate_windows

# At this point we are on Linux or macOS.
if [ "$PLATFORM" = "windows" ]; then
  log_err "windows detected without Git Bash; install.ps1 must be invoked under PowerShell directly"
  exit 1
fi

# Run under LC_ALL=C for deterministic byte-oriented text comparisons.
LC_ALL=C
export LC_ALL

# Root vs non-root install location.
_userid=$(id -u 2>/dev/null || printf '%s' "${USER:-}")
if [ "$_userid" = "0" ] || [ "${USER:-}" = "root" ]; then
  INSTALL_DIR="/usr/local/bin"
else
  INSTALL_DIR="${HOME}/.local/bin"
fi
mkdir -p "$INSTALL_DIR" || {
  log_err "could not create install dir: $INSTALL_DIR"
  exit 1
}

# Run dispatch matrix. Sets RESOLVED_TAG/BASE/CONTRACT/USE_LEGACY_RAW.
resolve_dispatch

# Verify install dir is not a symlink (basic reparse-equivalent guard).
if [ -L "$INSTALL_DIR" ]; then
  log_err "refusing to install into symlinked install dir: $INSTALL_DIR"
  exit 1
fi

# Set up temp directory for downloads.
TMP_DIR=$(mktemp -d -t umactually.XXXXXX 2>/dev/null) || {
  log_err "could not create temporary download directory"
  exit 1
}
TMP_CHECKSUMS="${TMP_DIR}/checksums.txt"
TMP_CHECKSUMS_NORM="${TMP_DIR}/checksums.normalized"
trap 'rm -rf "$TMP_DIR" 2>/dev/null || true' EXIT HUP INT TERM

ARCHIVE_NAME="umactually-${PLATFORM}-${ARCH}.tar.gz"
MEMBER_NAME="umactually-${PLATFORM}-${ARCH}"
INSTALLED_NAME="umactually"

TAR_FLAVOR=$(detect_tar_flavor)
if [ "$TAR_FLAVOR" = "bsd" ]; then
  # We support GNU and BSD tar; flag unknown as fatal.
  :
else
  # Default: GNU tar. The detect function only returns 'gnu' or 'bsd'.
  TAR_FLAVOR=gnu
fi

# Detect SHA-256 tool.
if command -v sha256sum >/dev/null 2>&1; then
  SHA_TOOL=sha256sum
elif command -v shasum >/dev/null 2>&1; then
  SHA_TOOL=shasum
else
  log_err "neither sha256sum nor shasum is installed"
  exit 1
fi

# Detect mv -- capability.
MV_HAS_DASHDASH=0
if detect_mv_dashdash; then
  MV_HAS_DASHDASH=1
fi

# Capture destination identity BEFORE any download (TOCTOU pre-check).
DEST_PATH="${INSTALL_DIR}/${INSTALLED_NAME}"
DEST_IDENTITY=$(capture_dest_identity "$DEST_PATH")

# ---- ARCHIVE FLOW ----
# If contract resolved to legacy raw (e.g. tag is in legacy allowlist), route
# to the legacy raw path. Archive-capable tags NEVER fall back to raw.
USE_LEGACY_RAW="${USE_LEGACY_RAW:-0}"
if [ "$USE_LEGACY_RAW" = "0" ] && [ "${RESOLVED_CONTRACT:-}" = "legacy" ]; then
  USE_LEGACY_RAW=1
fi

if [ "$USE_LEGACY_RAW" = "1" ]; then
  # ---- legacy raw flow ----
  if [ -z "${RESOLVED_BASE:-}" ]; then
    RESOLVED_BASE="$URL_BASE"
  fi
  RAW_URL="${RESOLVED_BASE}/${RAW_BINARY}"
  CHECKSUMS_URL="${RESOLVED_BASE}/checksums.txt"

  if ! http_get "$CHECKSUMS_URL" "$TMP_CHECKSUMS"; then
    log_err "could not download checksums: $CHECKSUMS_URL"
    exit 1
  fi
  normalize_crlf "$TMP_CHECKSUMS" "$TMP_CHECKSUMS_NORM"
  EXPECTED=$(checksum_legacy_select "$TMP_CHECKSUMS_NORM" "$RAW_BINARY") || {
    log_err "checksum file missing or malformed entry for $RAW_BINARY"
    exit 1
  }

  if ! http_get "$RAW_URL" "${TMP_DIR}/${RAW_BINARY}"; then
    log_err "could not download raw binary: $RAW_URL"
    exit 1
  fi
  ACTUAL=$(sha256_file "$SHA_TOOL" "${TMP_DIR}/${RAW_BINARY}")
  if [ "$ACTUAL" != "$EXPECTED" ]; then
    log_err "checksum verification failed for ${RAW_BINARY}"
    exit 1
  fi

  # Stream into staging file inside INSTALL_DIR (mode 0700).
  STAGING_DIR="${INSTALL_DIR}/.umactually-stage.$$"
  mkdir -m 0700 -p "$STAGING_DIR" || {
    log_err "could not create staging dir: $STAGING_DIR"
    exit 1
  }
  STAGED="${STAGING_DIR}/${INSTALLED_NAME}"
  cp "${TMP_DIR}/${RAW_BINARY}" "$STAGED" || {
    log_err "could not stage raw binary"
    rm -rf "$STAGING_DIR" 2>/dev/null || true
    exit 1
  }
  chmod 0755 "$STAGED"

  # Re-validate destination identity.
  assert_dest_identity_stable "$DEST_PATH" "$DEST_IDENTITY"

  # Atomic mv (portable --).
  if [ "$MV_HAS_DASHDASH" = "1" ]; then
    mv -f -- "$STAGED" "$DEST_PATH"
  else
    mv -f "$STAGED" "$DEST_PATH"
  fi
  rm -rf "$STAGING_DIR" 2>/dev/null || true

  # Verify the final installed binary is a regular non-link file.
  if [ -L "$DEST_PATH" ] || [ ! -f "$DEST_PATH" ]; then
    log_err "post-install verification failed: $DEST_PATH is not a regular file"
    exit 1
  fi

  printf '\nInstalled umactually to %s\n\n  %s --version\n' "$DEST_PATH" "$DEST_PATH"
  exit 0
fi

# ---- archive flow (tar.gz) ----
ARCHIVE_URL="${RESOLVED_BASE}/${ARCHIVE_NAME}"

if ! http_get "${RESOLVED_BASE}/checksums.txt" "$TMP_CHECKSUMS"; then
  log_err "could not download checksums: ${RESOLVED_BASE}/checksums.txt"
  exit 1
fi
normalize_crlf "$TMP_CHECKSUMS" "$TMP_CHECKSUMS_NORM"

checksum_archive_validate "$TMP_CHECKSUMS_NORM" "$ARCHIVE_NAME" || exit 1
EXPECTED_HASH=$EXPECTED_HASH

# Download archive.
TMP_ARCHIVE="${TMP_DIR}/${ARCHIVE_NAME}"
if ! http_get "$ARCHIVE_URL" "$TMP_ARCHIVE"; then
  log_err "could not download archive: $ARCHIVE_URL"
  exit 1
fi

ACTUAL_HASH=$(sha256_file "$SHA_TOOL" "$TMP_ARCHIVE")
if [ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]; then
  log_err "checksum verification failed for ${ARCHIVE_NAME}"
  exit 1
fi

# Verify tarball contains exactly one record equal to MEMBER_NAME (without
# pipefail; capture the full output then count records).
TAR_LIST_TMP="${TMP_DIR}/tar.list"
tar_list_names "$TMP_ARCHIVE" > "$TAR_LIST_TMP" || {
  log_err "tar -tzf failed for $TMP_ARCHIVE"
  exit 1
}
tr -d '\r' < "$TAR_LIST_TMP" > "${TAR_LIST_TMP}.lf"
mv "${TAR_LIST_TMP}.lf" "$TAR_LIST_TMP"
LIST_COUNT=$(wc -l < "$TAR_LIST_TMP" | tr -d ' ')
if [ "$LIST_COUNT" != "1" ]; then
  log_err "archive must contain exactly 1 member (found: $LIST_COUNT)"
  exit 1
fi
ONLY_MEMBER=$(cat "$TAR_LIST_TMP")
if [ "$ONLY_MEMBER" != "$MEMBER_NAME" ]; then
  log_err "member name mismatch: archive member '$ONLY_MEMBER' does not match expected '$MEMBER_NAME'"
  exit 1
fi

# Verify the single member is a regular file (first char of long listing is '-').
TAR_LONG_TMP="${TMP_DIR}/tar.long"
tar_list_long "$TMP_ARCHIVE" > "$TAR_LONG_TMP" || {
  log_err "tar -tvzf failed for $TMP_ARCHIVE"
  exit 1
}
tr -d '\r' < "$TAR_LONG_TMP" > "${TAR_LONG_TMP}.lf"
mv "${TAR_LONG_TMP}.lf" "$TAR_LONG_TMP"
LONG_COUNT=$(wc -l < "$TAR_LONG_TMP" | tr -d ' ')
if [ "$LONG_COUNT" != "1" ]; then
  log_err "tar -tvzf must report exactly 1 record (found: $LONG_COUNT)"
  exit 1
fi
FIRST_CHAR=$(cut -c1 "$TAR_LONG_TMP")
if [ "$FIRST_CHAR" != "-" ]; then
  log_err "archive member is not a regular file (first char: '$FIRST_CHAR')"
  exit 1
fi

# Create mode-0700 staging dir inside INSTALL_DIR (same filesystem for atomic mv).
STAGING_DIR="${INSTALL_DIR}/.umactually-stage.$$"
mkdir -m 0700 -p "$STAGING_DIR" || {
  log_err "could not create staging dir: $STAGING_DIR"
  exit 1
}

# Selectively extract only the exact basename.
tar_extract_member "$TMP_ARCHIVE" "$MEMBER_NAME" "$STAGING_DIR" "$TAR_FLAVOR" || {
  log_err "tar extract failed for member $MEMBER_NAME"
  rm -rf "$STAGING_DIR" 2>/dev/null || true
  exit 1
}

# Require exactly one regular object in the staging dir. Use find -P to avoid
# following symlinks, then check each entry with test -f (and ! test -L).
EXTRACTED_COUNT=0
EXTRACTED_TARGET=""
for _entry in $(find -P "$STAGING_DIR" -mindepth 1 -maxdepth 1); do
  EXTRACTED_COUNT=$((EXTRACTED_COUNT + 1))
  EXTRACTED_TARGET=$_entry
done
if [ "$EXTRACTED_COUNT" -ne 1 ]; then
  log_err "staging dir must contain exactly 1 entry (found: $EXTRACTED_COUNT)"
  rm -rf "$STAGING_DIR" 2>/dev/null || true
  exit 1
fi

# Reject any non-regular or symlink object.
if [ -L "$EXTRACTED_TARGET" ]; then
  log_err "extracted entry is a symlink"
  rm -rf "$STAGING_DIR" 2>/dev/null || true
  exit 1
fi
if [ ! -f "$EXTRACTED_TARGET" ]; then
  log_err "extracted entry is not a regular file"
  rm -rf "$STAGING_DIR" 2>/dev/null || true
  exit 1
fi

# Link count must be 1 (where stat supports it).
_link_flavor=$(detect_stat_links_flavor "$EXTRACTED_TARGET" 2>/dev/null || printf '')
case "$_link_flavor" in
  gnu) _nlinks=$(stat -c '%h' "$EXTRACTED_TARGET") ;;
  bsd) _nlinks=$(stat -f '%l' "$EXTRACTED_TARGET") ;;
  *) _nlinks="" ;;
esac
if [ -n "$_nlinks" ] && [ "$_nlinks" != "1" ]; then
  log_err "extracted entry has link count != 1 (found: $_nlinks)"
  rm -rf "$STAGING_DIR" 2>/dev/null || true
  exit 1
fi

# Extracted bytes <= 150,000,000.
_bytes_flavor=$(detect_stat_bytes_flavor "$EXTRACTED_TARGET" 2>/dev/null || printf '')
case "$_bytes_flavor" in
  gnu) _bytes=$(stat -c '%s' "$EXTRACTED_TARGET") ;;
  bsd) _bytes=$(stat -f '%z' "$EXTRACTED_TARGET") ;;
  *) _bytes=$(cat "$EXTRACTED_TARGET" | wc -c | tr -d ' ') ;;
esac
if [ "$_bytes" -gt "$MAX_EXTRACTED_BYTES" ]; then
  log_err "extracted bytes exceed safety limit (${_bytes} > ${MAX_EXTRACTED_BYTES})"
  rm -rf "$STAGING_DIR" 2>/dev/null || true
  exit 1
fi

# chmod 0755 the staged file.
chmod 0755 "$EXTRACTED_TARGET" || {
  log_err "could not chmod staged file"
  rm -rf "$STAGING_DIR" 2>/dev/null || true
  exit 1
}

# Re-validate destination identity before replacement.
assert_dest_identity_stable "$DEST_PATH" "$DEST_IDENTITY"

# Real staged --version smoke test (default ON; tests may opt out via
# INSTALL_TEST_NO_SMOKE).
if [ -z "${INSTALL_TEST_NO_SMOKE:-}" ]; then
  if ! "$EXTRACTED_TARGET" --version >/dev/null 2>&1; then
    log_err "staged --version failed (smoke test)"
    rm -rf "$STAGING_DIR" 2>/dev/null || true
    exit 1
  fi
fi

# Atomic mv (portable --).
if [ "$MV_HAS_DASHDASH" = "1" ]; then
  mv -f -- "$EXTRACTED_TARGET" "$DEST_PATH"
else
  mv -f "$EXTRACTED_TARGET" "$DEST_PATH"
fi
rm -rf "$STAGING_DIR" 2>/dev/null || true

# Final verification: regular non-link file with --version working.
if [ -L "$DEST_PATH" ] || [ ! -f "$DEST_PATH" ]; then
  log_err "post-install verification failed: $DEST_PATH is not a regular file"
  exit 1
fi
if [ -z "${INSTALL_TEST_NO_SMOKE:-}" ]; then
  if ! "$DEST_PATH" --version >/dev/null 2>&1; then
    log_err "final installed --version failed"
    exit 1
  fi
fi

# PATH update (skip when UMACTUALLY_NO_PATH_UPDATE is set).
if [ -z "${UMACTUALLY_NO_PATH_UPDATE:-}" ]; then
  case ":${PATH}:" in
    *":${INSTALL_DIR}:"*) ;;
    *)
      ADDED_PATH=1
      for rcfile in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
        if [ -f "$rcfile" ]; then
          if ! grep -q "${INSTALL_DIR}" "$rcfile" 2>/dev/null; then
            {
              printf '\n# Added by umactually installer\nexport PATH="%s:$PATH"\n' "$INSTALL_DIR"
            } >> "$rcfile"
          fi
          break
        fi
      done
      ;;
  esac
fi

printf '\nInstalled umactually to %s\n\n  %s --version\n' "$DEST_PATH" "$DEST_PATH"
if [ "${ADDED_PATH:-0}" = "1" ]; then
  printf '\nNOTE: %s was added to your PATH in your shell config.\nRestart your terminal (or run: source ~/.zshrc / ~/.bashrc) to use umactually directly.\n' "$INSTALL_DIR"
fi

exit 0