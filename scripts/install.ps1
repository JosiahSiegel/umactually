# SPDX-License-Identifier: MIT
# Universal installer for umactually standalone binary (Windows).
#
# Usage (PowerShell):
#   irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.ps1 | iex
#
# Test modes (used by test/unit/install-scripts-powershell.test.ts and
# test/unit/install-archives-powershell.test.ts):
#   $env:INSTALL_TEST_MODE=1; $env:INSTALL_TEST_DIR="C:\temp\sandbox"; ./install.ps1
#     - skips the network download
#     - writes a stub script to INSTALL_TEST_DIR\umactually.exe
#   $env:INSTALL_TEST_ARCHIVE_MODE=1; $env:INSTALL_TEST_DIR="C:\temp\sandbox"
#     - skips the network download
#     - reads INSTALL_TEST_ZIP=<path-to-real-zip> and INSTALL_TEST_CHECKSUMS=<path-to-checksums>
#     - validates archive checksum, streams exactly one entry, smoke-tests,
#       and atomically replaces INSTALL_TEST_DIR\umactually.exe

$ErrorActionPreference = "Stop"

# PowerShell 5.1 (Windows PowerShell) does not auto-load
# System.IO.Compression or System.IO.Compression.FileSystem when ZipArchive
# is referenced, which causes "Unable to find type [System.IO.Compression.
# ZipArchiveMode]". PowerShell 7+ does this implicitly, so the Add-Type
# calls are no-ops there.
foreach ($asm in 'System.IO.Compression', 'System.IO.Compression.FileSystem') {
  try {
    Add-Type -AssemblyName $asm -ErrorAction Stop
  } catch {
    # Already loaded (PowerShell 7+) or otherwise unavailable; the archive
    # code below will surface the failure if the type is truly missing.
  }
}

# Force TLS 1.2. PowerShell 5.1 (Windows PowerShell) defaults to TLS 1.0/1.1,
# which GitHub rejects — causing "The connection was closed unexpectedly"
# before the request even reaches the asset endpoint. This is a no-op on
# PowerShell 7+ (which already uses TLS 1.2+).
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {
  # PowerShell Core doesn't support setting this; it already uses TLS 1.2+.
}

# Opt-in revocation check bypass for Windows Git Bash users whose
# network cannot reach GitHub's OCSP responder. Without this, the
# legacy / archive / checksum / latest-endpoint Invoke-WebRequest
# calls below hit `CRYPT_E_REVOCATION_OFFLINE (0x80092013)` and
# fail. Setting CheckCertificateRevocationList = $false skips the
# optional CRL/OCSP lookup while keeping cert validation enabled
# (we are NOT using `-SkipCertificateCheck`, which would disable
# ALL cert validation and is a security regression). The setting
# must happen BEFORE any Invoke-WebRequest call, and it must be
# honored by both the legacy and archive install paths.
#
# Only fires when the operator explicitly opts in via the early-arg
# handler (`-ssl-no-revoke` / `-SChannelOptOut` / etc) or the env
# var directly. The env var is the POSIX equivalent (`INSTALL_SSL_NO_REVOKE=1`)
# that the README documents for install.sh.
#
# v0.6.0 caveat: this setting ONLY takes effect on Windows PowerShell
# 5.1 (where Invoke-WebRequest uses the legacy HttpWebRequest
# pipeline that respects ServicePointManager). On PowerShell Core
# (the standard on `windows-latest` since 2020, and the default on
# modern Windows installs), PowerShell 7+ routes Invoke-WebRequest
# through HttpClient, which does NOT consult
# ServicePointManager::CheckCertificateRevocationList. The setting
# silently no-ops on PS Core — Invoke-WebRequest still hits
# CRL/OCSP and the user sees the original `CRYPT_E_REVOCATION_OFFLINE`
# failure even with `INSTALL_SSL_NO_REVOKE=1`. We surface this with
# a visible Write-Warning (not just Write-Verbose) so a user who
# copy/pasted the README's `irm .../install.ps1 | iex -ssl-no-revoke`
# line on PS Core immediately knows the flag didn't work and can
# fall back to install.sh (which honors the env var for real via
# the `curl --ssl-no-revoke` path).
if ($env:INSTALL_SSL_NO_REVOKE -eq '1') {
  # $PSEdition is 'Core' on PowerShell 7+ and 'Desktop' on Windows
  # PowerShell 5.1. We gate the user-facing warning on this so PS 5.1
  # users (the only runtime where the setting actually takes effect)
  # do not see a false-positive warning.
  $isPsCore = ($PSVersionTable.PSEdition -eq 'Core') -or ($PSVersionTable.Platform -eq 'Unix')
  # Stream-routing caveat: PowerShell's user-facing stream surface
  # is host-dependent. Write-Warning on Linux PS Core 7+ lands on
  # stdout, on Windows PS 5.1 on stderr, on Windows PS Core 7+ on
  # the information stream (which Node.js's spawnSync does NOT
  # capture in either stdout or stderr). [Console]::Error.WriteLine
  # on Windows PS Core 7+ in non-interactive script context can
  # also be lost if the host routes Console.Error away from fd 2
  # (observed in CI windows + PowerShell job). To guarantee the
  # warning is observable both by a real user and by the test
  # harness regardless of host, we:
  #   1. Write the message to the warning stream (interactive
  #      terminal: yellow WARNING: prefix).
  #   2. Write to [Console]::Error (best-effort stderr on most hosts).
  #   3. Append to a marker file at
  #      $env:INSTALL_SSL_NO_REVOKE_WARNING_FILE if set (test seam:
  #      the install-archives-powershell test points this at a
  #      tmpfile in its sandbox and reads the file to assert the
  #      warning fired, host-agnostic).
  function _emitSslNoRevokeWarning([string]$message) {
    [Console]::Error.WriteLine($message)
    Write-Warning $message
    if ($env:INSTALL_SSL_NO_REVOKE_WARNING_FILE) {
      # Resolve the path to an absolute form so the writer does
      # not depend on the script's CWD (which can differ between
      # interactive shells and the GitHub Actions CI bootstrap).
      # We use the .NET APIs directly (rather than Split-Path /
      # Test-Path / New-Item cmdlets) because the cmdlet
      # parameter sets differ between Windows PowerShell 5.1
      # (Desktop) and PowerShell Core 7+ across platforms
      # (observed: Split-Path -LiteralPath -Parent throws
      # "Parameter set cannot be resolved" on PS Core 7.6 on
      # Linux in some script contexts). [System.IO.Path] and
      # [System.IO.File] / [System.IO.Directory] are stable
      # across all hosts we ship for.
      $markerPath = $env:INSTALL_SSL_NO_REVOKE_WARNING_FILE
      try {
        $resolved = [System.IO.Path]::GetFullPath($markerPath)
        $parentDir = [System.IO.Path]::GetDirectoryName($resolved)
        if ($parentDir -and -not [System.IO.Directory]::Exists($parentDir)) {
          $null = [System.IO.Directory]::CreateDirectory($parentDir)
        }
        [System.IO.File]::AppendAllText($resolved, $message + [Environment]::NewLine)
      } catch {
        # Test-seam write is best-effort. We do not let a
        # filesystem error here change the install behavior —
        # the warning is already on the user-facing streams.
        # But surface the error to the host's error stream so
        # a developer running the test interactively can see
        # WHY the marker file wasn't written (otherwise the
        # test fails opaquely with "ENOENT: file not found").
        Write-Warning "INSTALL_SSL_NO_REVOKE_WARNING_FILE write failed: $_"
      }
    }
  }
  try {
    [System.Net.ServicePointManager]::CheckCertificateRevocationList = $false
    if ($isPsCore) {
      _emitSslNoRevokeWarning ("--ssl-no-revoke: this PowerShell runtime (" +
        $PSVersionTable.PSVersion.ToString() + ", edition=" +
        $PSVersionTable.PSEdition + ") routes Invoke-WebRequest through " +
        "HttpClient, which does NOT honor ServicePointManager's " +
        "CheckCertificateRevocationList. The setting above is a no-op. " +
        "Use install.sh instead (curl --ssl-no-revoke honors this env var " +
        "for real), or run this script under Windows PowerShell 5.1.")
    }
  } catch {
    # The catch path covers non-Windows PS Core where the
    # ServicePointManager type is not even available. The warning
    # above already tells the user to use install.sh; we do not
    # double-warn here.
    _emitSslNoRevokeWarning ("--ssl-no-revoke: ServicePointManager not available on " +
      "this runtime (" + $PSVersionTable.PSVersion.ToString() + ", " +
      "edition=" + $PSVersionTable.PSEdition + "). The bypass has no " +
      "effect; use install.sh (curl --ssl-no-revoke) instead.")
  }
}

# ---- early argument handling: --help / --version / --dry-run ----
# These MUST be handled before the smart-router runs, because the
# smart-router would otherwise treat e.g. `-h` as "install with these
# args" and either (a) call `npm install -g umactually` on the user's
# machine or (b) download the Windows binary. The CI smoke test
# `install.ps1 --help` would otherwise FAIL the "script doesn't even
# parse" guard. We deliberately do NOT accept a `-h` short form here —
# PowerShell conventions and the install.sh twin both use `--help` and
# `-h`, and a leading `-` with no following character is what PowerShell
# emits when you pass a bare `-h` flag.
foreach ($arg in $args) {
  if ($arg -eq '-h' -or $arg -eq '--help' -or $arg -eq '-Help' -or $arg -eq '/?') {
    Write-Output @'
umactually installer

Usage:
  # Save first, then run with flags (most reliable across PowerShell 5.1 / 7+):
  irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.ps1 -OutFile install.ps1
  .\install.ps1 -TryNpm

  # Or one-shot via env var (no flag-parsing involved):
  $env:INSTALL_TRY_NPM = '1'
  irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.ps1 | iex

  # Or pin a specific tag via the env var:
  $env:INSTALL_RELEASE_TAG = 'v0.5.4'
  irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.ps1 | iex


Flags (also accepted as env vars):
  -Tag <vX.Y.Z>          Pin to a specific release tag. Env: INSTALL_RELEASE_TAG.
  -Base <url>            Use a custom asset directory URL. Env: INSTALL_RELEASE_BASE.
  -Contract <a|legacy>   Force archive or legacy raw contract. Env: INSTALL_ASSET_CONTRACT.
  -InstallDir <path>     Override install destination. Env: INSTALL_DIR_OVERRIDE.
  -SChannelOptOut        Skip TLS revocation checks (Windows Schannel only).
                         Env: INSTALL_SSL_NO_REVOKE. Same caveats as install.sh.
                         Accepts the README's `--ssl-no-revoke` and `-SslNoRevoke`
                         aliases too so a copy/paste from the README works on
                         Windows.
  -TryNpm                Opt in to the npm-install smart router (added in v0.6.0).
                         Env: INSTALL_TRY_NPM=1. Off by default because the
                         umactually npm package is not yet published; falls
                         through to the binary download when npm 404s.

Env vars (override flags):
  INSTALL_RELEASE_TAG, INSTALL_RELEASE_BASE, INSTALL_ASSET_CONTRACT,
  INSTALL_DIR_OVERRIDE, INSTALL_SSL_NO_REVOKE, INSTALL_TRY_NPM

The installer auto-detects the contract from the published
checksums.txt when no flag/env is supplied.
'@
    exit 0
  }
  if ($arg -eq '-V' -or $arg -eq '--version') {
    Write-Output 'umactually installer (script tied to v0.6.0 install contract)'
    exit 0
  }
  # `--ssl-no-revoke` (README copy/paste form), `-SslNoRevoke` (PowerShell
  # canonical alias form), and `-SChannelOptOut` (the historical install.ps1
  # form documented above) all opt in to skipping TLS revocation checks.
  # Without this handler a Windows Git Bash user copy/pasting the README's
  # `irm .../install.ps1 | iex -ssl-no-revoke` line would see the flag
  # silently dropped: the smart-router would treat it as an install arg
  # and either call `npm install -g umactually` or fall through to a
  # binary download that still hits CRL/OCSP via Invoke-WebRequest.
  if ($arg -eq '-ssl-no-revoke' -or $arg -eq '--ssl-no-revoke' `
      -or $arg -eq '-SslNoRevoke' -or $arg -eq '-SChannelOptOut') {
    $env:INSTALL_SSL_NO_REVOKE = '1'
    # Don't shift $args — the rest of the script reads via $env:.
    continue
  }
  # `-TryNpm` (PowerShell canonical form) and `--try-npm` (README
  # copy/paste form, mirroring install.sh) opt in to the v0.6.0
  # npm-install smart router. Without this handler a user following
  # the help's `irm .../install.ps1 | iex -TryNpm` example would
  # see the flag silently dropped: the smart-router block reads
  # $env:INSTALL_TRY_NPM, not the positional arg, and without
  # INSTALL_TRY_NPM=1 the smart-router is off (the umactually npm
  # package is not yet published, so the default is the binary
  # download path). Mirrors the install.sh twin's --try-npm handler
  # and the install-smart-router test contract.
  if ($arg -eq '-TryNpm' -or $arg -eq '--try-npm') {
    $env:INSTALL_TRY_NPM = '1'
    continue
  }
}

# ---- smart installer: npm if Node 24+ is available, else binary ----
# Added in v0.6.0. Runs BEFORE any network work. If Node 24+ is on PATH,
# runs `npm install -g umactually` and exits cleanly. Otherwise falls
# through to the existing binary download logic.
#
# v0.6.0-dev note: the umactually npm package is NOT yet published,
# so the smart-router will hit E404 in production. We default it to
# "opt-in" via INSTALL_TRY_NPM=1 until publish happens. Set
# INSTALL_TRY_NPM=0 (or leave it unset) to always use the binary path.
# The CI smoke test asserts on the absence of "trying npm install"
# in stderr for this reason.
function Invoke-SmartInstallNpm {
  # Search for a usable Node.exe. Order of preference:
  #   1. Get-Command -All node   — honors PATH, App Paths, and any
  #      shell-managed location (this catches most setups including
  #      nvm-windows / fnm when their shim is on PATH).
  #   2. Common install roots (Program Files, Program Files (x86),
  #      per-user Programs) — covers the standard .msi installer.
  #   3. nvm-windows default root (%APPDATA%\nvm\v<major>.<minor>.<patch>\)
  #      and the fnm per-user default (%LOCALAPPDATA%\fnm\node-versions\...)
  #      — documented Node upgrade paths for contributors
  #      (per scripts/build-sea.mjs, the repo recommends fnm use).
  #   4. Per-user fnm version-pinned shim (%LOCALAPPDATA%\fnm_multishells).
  $nodeCmd = $null
  $allNode = Get-Command 'node' -All -ErrorAction SilentlyContinue
  if ($allNode) {
    # `Get-Command -All` returns node binaries in PATH-order, which is
    # NOT necessarily highest-version-first. On a host with multiple
    # node installs (nvm-windows + fnm + system), PATH-order can pick
    # a stale 22.x binary over a fresh 25.x. Probe each candidate's
    # version and pick the highest major.minor.patch.
    $bestNode = $null
    $bestVersion = $null
    foreach ($cand in $allNode) {
      if (-not $cand.Source) { continue }
      $v = & $cand.Source -v 2>$null
      if (-not $v) { continue }
      if ($v -match '^v(\d+)\.(\d+)\.(\d+)') {
        $ver = [version]($Matches[1] + '.' + $Matches[2] + '.' + $Matches[3])
        if ($null -eq $bestVersion -or $ver -gt $bestVersion) {
          $bestVersion = $ver
          $bestNode = $cand.Source
        }
      }
    }
    if ($bestNode) { $nodeCmd = $bestNode }
  }
  if (-not $nodeCmd) {
    foreach ($dir in @(
      "$env:ProgramFiles\nodejs",
      "$env:ProgramFiles(x86)\nodejs",
      "$env:LOCALAPPDATA\Programs\nodejs"
    )) {
      $exe = Join-Path $dir 'node.exe'
      if (Test-Path $exe) { $nodeCmd = $exe; break }
    }
  }
  if (-not $nodeCmd -and $env:APPDATA) {
    # nvm-windows default install root. Newer versions live under
    # v<version>\node.exe; older ones had <version>\node.exe. We pick
    # the highest version directory that contains a node.exe.
    $nvmRoot = Join-Path $env:APPDATA 'nvm'
    if (Test-Path $nvmRoot) {
      $candidates = Get-ChildItem -LiteralPath $nvmRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'node.exe') } |
        Sort-Object { [version]($_.Name -replace '^v', '') } -Descending
      if ($candidates) { $nodeCmd = Join-Path $candidates[0].FullName 'node.exe' }
    }
  }
  if (-not $nodeCmd -and $env:LOCALAPPDATA) {
    # fnm default per-user install: %LOCALAPPDATA%\fnm\node-versions\<version>\installation\node.exe
    $fnmRoot = Join-Path $env:LOCALAPPDATA 'fnm\node-versions'
    if (Test-Path $fnmRoot) {
      $candidates = Get-ChildItem -LiteralPath $fnmRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'installation\node.exe') } |
        Sort-Object { [version]($_.Name -replace '^v', '') } -Descending
      if ($candidates) { $nodeCmd = Join-Path $candidates[0].FullName 'installation\node.exe' }
    }
  }
  if (-not $nodeCmd) { return $false }

  $versionOutput = & $nodeCmd -v 2>$null
  if (-not $versionOutput) { return $false }
  # $versionOutput is something like "v24.5.0". Parse the major.
  if ($versionOutput -match '^v(\d+)\.') {
    $major = [int]$Matches[1]
  } else {
    return $false
  }
  if ($major -lt 24) {
    Write-Verbose "Node major is $major (< 24); falling back to binary download"
    return $false
  }

  Write-Output "umactually: Node $versionOutput detected, using npm install"
  $npmArgs = @('install', '-g', 'umactually')
  # Honor INSTALL_RELEASE_TAG (set by --tag flag) so a user can pin to
  # a specific version. Without this, the smart-router always installs
  # the @latest tag, silently overriding the --tag flag for the npm
  # path. Strip a leading 'v' from the tag because npm's version
  # specifier syntax rejects the 'v' prefix.
  if ($env:INSTALL_RELEASE_TAG) {
    $tagForNpm = $env:INSTALL_RELEASE_TAG -replace '^v', ''
    $npmArgs = @('install', '-g', "umactually@$tagForNpm")
  }
  # Capture npm's stderr so we can surface a useful diagnostic on the
  # fall-through path. Without this capture the user sees only the
  # "npm install failed" line, which is unhelpful when the failure
  # is "package not yet published to npm" (E404) vs. "permission
  # denied writing to NPM_CONFIG_PREFIX/bin" (EACCES) — the two
  # failure modes have completely different remediations.
  $npmErrFile = [System.IO.Path]::GetTempFileName()
  try {
    & npm @npmArgs 2> $npmErrFile
    if ($LASTEXITCODE -eq 0) {
      # PATH sanity check: npm says it succeeded, but if the binary
      # isn't on PATH (e.g. NPM_CONFIG_PREFIX not exported) the user
      # will think the install failed. Detect that here and surface
      # the prefix in the hint so they can fix PATH without
      # re-running the installer.
      $resolvedCmd = Get-Command umactually -ErrorAction SilentlyContinue
      if (-not $resolvedCmd) {
        $npmPrefix = & npm config get prefix 2>$null
        if ($LASTEXITCODE -eq 0 -and $npmPrefix) {
          # `npm config get prefix` returns the parent of `bin/` (POSIX) or
          # the directory that holds the .cmd shim directly (Windows).
          # Mirror scripts/install.sh's behavior so cross-platform pwsh
          # users get the correct hint.
          $isPosix = [System.IO.Path]::DirectorySeparatorChar -eq '/'
          $hintPath = if ($isPosix) { Join-Path $npmPrefix 'bin' } else { $npmPrefix }
          Write-Output "umactually: installed via npm, but 'umactually' is not on PATH."
          Write-Output "umactually: add '$hintPath' to your PATH and retry."
        } else {
          Write-Output "umactually: installed via npm, but 'umactually' is not on PATH."
        }
        exit 1
      }
      Write-Output "umactually: installed via npm. Run 'umactually --version' to verify."
      exit 0
    }
  } catch {
    # npm itself failed; fall through to binary download.
  }
  # Show the captured npm stderr in the fallback message so the user
  # knows WHY npm failed (network, E404, EACCES, etc.). Trim to one
  # line so a verbose npm error log doesn't drown the install banner.
  $npmErrTail = ''
  if (Test-Path -LiteralPath $npmErrFile) {
    $npmErrContent = Get-Content -LiteralPath $npmErrFile -Raw -ErrorAction SilentlyContinue
    if ($npmErrContent) {
      $firstLine = ($npmErrContent -split "`r?`n", 2)[0]
      if ($firstLine) { $npmErrTail = " ($firstLine.Trim())" }
    }
    Remove-Item -LiteralPath $npmErrFile -Force -ErrorAction SilentlyContinue
  }
  Write-Output "umactually: npm install failed, falling back to binary download$npmErrTail"
  return $false
}

# Only run the smart-router if no test/force-binary override is set AND
# the operator has explicitly opted in via INSTALL_TRY_NPM=1.
#
# Test bypasses (any of these short-circuit the smart-router so tests can
# exercise the binary-download / archive / checksum paths in isolation):
#   - INSTALL_TEST_MODE         — pure stub-binary fixture (line 763+)
#   - INSTALL_TEST_ARCHIVE_MODE — real-archive fixture (line 784+)
#   - INSTALL_TEST_TARBALL      — alternate archive fixture
#   - INSTALL_TEST_CHECKSUMS    — alternate checksums fixture
#   - INSTALL_TEST_FAKE_TAG     — pre-archive tag fixture
#   - INSTALL_TEST_FAKE_LATEST_URL — local fake /releases/latest URL
#   - INSTALL_GITHUB_API_BASE   — production override of the
#                                 /releases/latest URL (and a test
#                                 fixture override when pointed at a
#                                 local http server, e.g. by
#                                 install-archives-powershell.test.ts)
#   - INSTALL_FORCE_BINARY      — operator opt-out
#   - INSTALL_RELEASE_BASE      — point at a local fake release server
#     (test fixtures run a Node http server on 127.0.0.1; we MUST not
#     route to npm in that case or the test's HTTP traffic is masked
#     by a real npm call that 404s in CI)
# Without these guards, the smart-router makes a real `npm install -g
# umactually` call in CI, hits E404 (package not yet published to npm),
# and prints two error lines on stderr that contaminate every test that
# asserts on the install-script's actual error output.
#
# v0.6.0-dev: the umactually npm package is NOT yet published. The
# smart-router would 404 on every fresh install. We default to the
# binary path until publish happens; operators who want the npm
# path can opt in via INSTALL_TRY_NPM=1.
if (
  $env:INSTALL_TRY_NPM -eq '1' -and
  -not $env:INSTALL_TEST_MODE -and
  -not $env:INSTALL_TEST_ARCHIVE_MODE -and
  -not $env:INSTALL_TEST_TARBALL -and
  -not $env:INSTALL_TEST_CHECKSUMS -and
  -not $env:INSTALL_TEST_FAKE_TAG -and
  -not $env:INSTALL_TEST_FAKE_LATEST_URL -and
  -not $env:INSTALL_GITHUB_API_BASE -and
  -not $env:INSTALL_FORCE_BINARY -and
  -not $env:INSTALL_RELEASE_BASE
) {
  $null = Invoke-SmartInstallNpm
}

# ---- constants ----
$Repo = "JosiahSiegel/umactually"
$LatestApi = "https://api.github.com/repos/$Repo/releases/latest"
$UrlBaseLatest = "https://github.com/$Repo/releases/latest/download"
$DefaultRawBase = "https://github.com/$Repo/raw/main/scripts"
$DefaultScriptUrl = "$DefaultRawBase/install.ps1"

# Literal allowlist of pre-archive tags that ship raw executables.
$LegacyTagAllowlist = @("v0.2.1", "v0.3.0", "v0.4.0", "v0.4.1")

# Five canonical archive basenames (manifest order, fixed for the contract).
# `darwin-x64` (Intel macOS) was dropped in v0.6.0 — Node's `--build-sea`
# segfaults on darwin-x64 (nodejs/node#62893). Intel Mac users get the
# npm install path; the curl-pipe installer fails fast on darwin+x64
# with a pointer at `npm install -g umactually`. See CHANGELOG v0.6.0
# [Removed] and README § Install.
$ArchiveBasenames = @(
  "umactually-linux-x64.tar.gz",
  "umactually-linux-arm64.tar.gz",
  "umactually-darwin-arm64.tar.gz",
  "umactually-windows-x64.zip",
  "umactually-windows-arm64.zip"
)

# Five canonical raw basenames for legacy contract.
$RawBasenames = @(
  "umactually-linux-x64",
  "umactually-linux-arm64",
  "umactually-darwin-arm64",
  "umactually-windows-x64.exe",
  "umactually-windows-arm64.exe"
)

# ---- architecture detection ----
$NormalizedArch = if ($env:PROCESSOR_ARCHITECTURE) { $env:PROCESSOR_ARCHITECTURE.ToLower() } else { "" }
$Arch = switch -Wildcard ($NormalizedArch) {
  "amd64"   { "x64" }
  "x86_64"  { "x64" }
  "arm64"   { "arm64" }
  default   { "x64" }
}

# Windows installer always downloads a .zip containing one member named
# umactually-windows-<arch>.exe and installs it as umactually.exe.
$ArchiveName = "umactually-windows-$Arch.zip"
$MemberName  = "umactually-windows-$Arch.exe"
$RawName     = "umactually-windows-$Arch.exe"
$InstalledName = "umactually.exe"

# ---- install directory helpers ----
# Capture initial identity/metadata of the install directory and the destination
# file BEFORE we download or stage anything. We re-validate this same identity
# immediately before replacement to detect TOCTOU attacks.
function Get-InstallDirIdentity {
  param([string]$Path)
  if (!(Test-Path -LiteralPath $Path)) {
    return @{ Exists = $false; IsReparse = $false }
  }
  $item = Get-Item -LiteralPath $Path -Force
  $attrs = $item.Attributes
  $isReparse = ([bool]($attrs -band [IO.FileAttributes]::ReparsePoint))
  return @{ Exists = $true; IsReparse = $isReparse }
}

function Assert-InstallDirTrusted {
  # Require the install directory to exist as a real directory with no
  # ReparsePoint attribute. Re-stamp any reparse before staging/replacement.
  param([string]$Path)
  if (!(Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
  $id = Get-InstallDirIdentity -Path $Path
  if ($id.Exists -and $id.IsReparse) {
    throw "Refusing to install into reparse-point directory: $Path"
  }
  # Verify post-creation identity is also clean (covers race during New-Item).
  $id2 = Get-InstallDirIdentity -Path $Path
  if ($id2.IsReparse) {
    throw "Refusing to install into reparse-point directory (race): $Path"
  }
}

# ---- destination identity capture (TOCTOU guard) ----
# ---- SHA-256 helper (.NET-backed, Get-FileHash fallback) ----
#
# Returns a lowercase 64-char hex SHA-256 digest of the file at $Path.
#
# Uses [System.Security.Cryptography.SHA256]::Create() directly via the
# .NET BCL — works in *every* PowerShell environment, including the
# GitHub Actions `windows-2025-vs2026` runner image where the built-in
# Get-FileHash cmdlet from Microsoft.PowerShell.Utility is occasionally
# not auto-loaded on the cold-start path we use here (the failure mode
# is "Get-FileHash : The term 'Get-FileHash' is not recognized" and
# surfaces in CI run 29892175955's install-archives-powershell suite).
#
# Keep the Get-FileHash fallback for any host where the .NET SHA256
# stream-throws (extremely rare; v0.5.x was the only consumer).
function Get-FileHashSha256 {
  param([string]$Path)
  if (!(Test-Path -LiteralPath $Path)) {
    throw "Get-FileHashSha256: file not found: $Path"
  }
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
      $stream = [System.IO.File]::OpenRead($Path)
      try {
        $bytes = $sha.ComputeHash($stream)
      } finally {
        $stream.Dispose()
      }
    } finally {
      $sha.Dispose()
    }
    # Convert to lowercase hex manually so we don't depend on
    # BitConverter.ToString() (locale-sensitive on some hosts).
    $sb = New-Object System.Text.StringBuilder(64)
    foreach ($b in $bytes) {
      [void]$sb.AppendFormat("{0:x2}", $b)
    }
    return $sb.ToString()
  }
  catch {
    # Last-resort fallback: try the cmdlet. If that also fails, rethrow
    # the .NET error which has the more useful stack trace.
    if (Get-Command -Name Get-FileHash -ErrorAction SilentlyContinue) {
      return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    throw
  }
}

function Get-DestinationIdentity {
  param([string]$Path)
  if (!(Test-Path -LiteralPath $Path)) {
    return @{ Exists = $false }
  }
  $item = Get-Item -LiteralPath $Path -Force
  $attrs = $item.Attributes
  $isDirectory = ([bool]($attrs -band [IO.FileAttributes]::Directory))
  $isReparse   = ([bool]($attrs -band [IO.FileAttributes]::ReparsePoint))
  if ($isDirectory -or $isReparse) {
    throw "Refusing to overwrite non-regular destination: $Path (Directory=$isDirectory ReparsePoint=$isReparse)"
  }
  return @{
    Exists     = $true
    Length     = $item.Length
    LastWrite  = $item.LastWriteTimeUtc
    Sha256     = (Get-FileHashSha256 -Path $Path)
  }
}

function Assert-DestinationIdentityStable {
  # Re-validate destination identity matches what we captured before download.
  # Reject any identity/type change (TOCTOU).
  param(
    [string]$Path,
    [hashtable]$Expected
  )
  $current = if ($Expected.Exists) {
    Get-DestinationIdentity -Path $Path
  } else {
    if (Test-Path -LiteralPath $Path) {
      throw "Refusing to overwrite destination that appeared during install: $Path"
    }
    @{ Exists = $false }
  }
  if ($Expected.Exists -and -not $current.Exists) {
    throw "Refusing to overwrite destination that disappeared during install: $Path"
  }
  if ($Expected.Exists) {
    if ($current.Length -ne $Expected.Length) { throw "Destination identity changed (length): $Path" }
    if ($current.LastWrite -ne $Expected.LastWrite) { throw "Destination identity changed (mtime): $Path" }
    if ($current.Sha256 -ne $Expected.Sha256) { throw "Destination identity changed (sha256): $Path" }
  }
}

# ---- checksum file validation ----
# Canonical grammar: ^<64 hex>  <exact basename>$ (LF or CRLF; we normalize).
function Assert-ChecksumLineCanonical {
  param([string]$Line, [string]$ExpectedBasename)
  $trimmed = $Line.TrimEnd("`r")
  $pattern = "^[0-9A-Fa-f]{64}  ([Regex]::Escape($ExpectedBasename))$"
  return [Regex]::IsMatch($trimmed, $pattern)
}

function Parse-ChecksumLine {
  param([string]$Line)
  $trimmed = $Line.TrimEnd("`r")
  $m = [Regex]::Match($trimmed, "^([0-9A-Fa-f]{64})  (.+)$")
  if (!$m.Success) { return $null }
  return @{ Hash = $m.Groups[1].Value; Basename = $m.Groups[2].Value }
}

function Resolve-ChecksumContract {
  # Decide archive vs legacy based on the resolved tag and override matrix.
  # Resolve-Tag has already validated the explicit contract value up front;
  # this function only resolves the contract for the supplied tag.
  param([string]$Tag)
  if ($env:INSTALL_ASSET_CONTRACT) {
    return $env:INSTALL_ASSET_CONTRACT.ToLower()
  }
  if ($LegacyTagAllowlist -contains $Tag) { return "legacy" }
  return "archive"
}

function Resolve-Tag {
  # Eight-case override matrix, mirrored from the POSIX installer:
  #  1. no overrides => GET GitHub latest, require HTTP 200, draft=false,
  #     prerelease=false, strict ^v[0-9]+\.[0-9]+\.[0-9]+$, infer contract
  #  2. tag only => use default /releases/download/<tag>
  #  3. base only => legacy raw flow (no tag needed; use supplied base)
  #  4. contract only => reject (no base to derive raw URL)
  #  5. base+tag => use supplied base, infer contract from tag
  #  6. base+tag+contract => use supplied base/tag and explicit contract
  #  7. base+contract without tag => legacy raw flow (explicit legacy contract)
  #  8. INSTALL_POWERSHELL_SCRIPT_URL only changes Git Bash delegation
  #
  # Cases 3 and 7 are allowed only when the contract is legacy: pre-archive
  # releases (v0.2.1..v0.4.1) ship raw executables (no archive), so the user
  # supplies the asset base directly without a tag. Archive-mode rejects the
  # same cases (handled here by failing case 4 only, since archive requires
  # an immutable tag asset URL — see Resolve-Tag dispatcher for archive path).
  #
  # Validate the explicit contract value up front so an invalid value fails
  # closed before any network resolution.
  if ($env:INSTALL_ASSET_CONTRACT) {
    $contractLower = $env:INSTALL_ASSET_CONTRACT.ToLower()
    if ($contractLower -ne "archive" -and $contractLower -ne "legacy") {
      throw "Invalid INSTALL_ASSET_CONTRACT: '$env:INSTALL_ASSET_CONTRACT' (must be 'archive' or 'legacy')"
    }
  }
  if ($env:INSTALL_RELEASE_TAG -and -not $env:INSTALL_RELEASE_BASE -and -not $env:INSTALL_ASSET_CONTRACT) {
    return @{ Tag = $env:INSTALL_RELEASE_TAG }
  }
  if ($env:INSTALL_RELEASE_TAG -and $env:INSTALL_RELEASE_BASE -and -not $env:INSTALL_ASSET_CONTRACT) {
    return @{ Tag = $env:INSTALL_RELEASE_TAG; Base = $env:INSTALL_RELEASE_BASE }
  }
  if ($env:INSTALL_RELEASE_TAG -and $env:INSTALL_RELEASE_BASE -and $env:INSTALL_ASSET_CONTRACT) {
    return @{
      Tag = $env:INSTALL_RELEASE_TAG
      Base = $env:INSTALL_RELEASE_BASE
      Contract = $env:INSTALL_ASSET_CONTRACT.ToLower()
    }
  }
  # Order matters: case 7 (base + contract, no tag) must be checked BEFORE case 3
  # (base only, no tag) because case 7's `INSTALL_ASSET_CONTRACT=archive` is a
  # reject for archive flow, while the legacy test uses case 3 (no contract).
  # Case 7 wins for any explicit contract; case 3 only matches when contract is
  # unset.
  if ($env:INSTALL_RELEASE_BASE -and $env:INSTALL_ASSET_CONTRACT -and -not $env:INSTALL_RELEASE_TAG) {
    $contractLower = $env:INSTALL_ASSET_CONTRACT.ToLower()
    if ($contractLower -eq "legacy") {
      # Case 7 accept (legacy): base + explicit legacy contract without tag.
      # Use supplied base directly; tag is irrelevant for legacy raw releases.
      return @{
        Tag = $null
        Base = $env:INSTALL_RELEASE_BASE
        Contract = "legacy"
      }
    }
    # Case 7 reject (archive): archive flow requires an immutable tag asset URL,
    # not a user-supplied base. Bail out cleanly.
    throw "INSTALL_RELEASE_BASE + INSTALL_ASSET_CONTRACT=archive without INSTALL_RELEASE_TAG is invalid (case 7 reject)"
  }
  if ($env:INSTALL_RELEASE_BASE -and -not $env:INSTALL_RELEASE_TAG) {
    # Case 3 disambiguation: the supplied base may point at either an archive
    # contract release or a pre-archive (legacy) raw release. The plan's 8-case
    # matrix says case 3 is normally a reject, but legacy raw releases don't
    # fit the immutable-tag asset URL model — they expect users to point at a
    # known base (their local copy of v0.4.1, say) and download the raw binary.
    # Resolve-Tag has no other signal to distinguish: in both legacy and
    # archive usage, the user supplies the same env vars. We make a single
    # small content probe — fetch checksums.txt, look at the first basename —
    # to decide which contract the base actually serves.
    #
    # - probe succeeds AND first basename is a raw basename → legacy raw flow
    # - probe succeeds AND first basename is an archive basename → reject
    # - probe fails (network, missing, malformed) → reject (default closed)
    #
    # The matrix test PS-MATRIX-001 uses a dead URL (port 1) so the probe
    # fails and the case 3 reject fires. The legacy test PS-INSTALL-004/005
    # uses a live URL whose checksums.txt has the raw basename
    # `umactually-windows-x64.exe` so the probe succeeds and we accept legacy.
    $probeRaw = $false
    try {
      $tmpRoot = if ($env:TEMP) { $env:TEMP }
                  elseif ($env:TMPDIR) { $env:TMPDIR }
                  else { [System.IO.Path]::GetTempPath() }
      $probePath = Join-Path $tmpRoot ".probe-$([Guid]::NewGuid().ToString('N')).tmp"
      try {
        Invoke-WebRequest -Uri "$($env:INSTALL_RELEASE_BASE)/checksums.txt" `
          -OutFile $probePath -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        $firstLines = @(Get-Content -LiteralPath $probePath -TotalCount 1 -ErrorAction SilentlyContinue)
        if ($firstLines.Count -gt 0) {
          # Probe goal: does this base serve raw binaries (legacy) or archive
          # entries (archive)? We look at the first checksum-line basename.
          # The line may be malformed in the tests (e.g. an all-zero hash,
          # missing entry, or `not-a-sha256  ...`), but the basename shape
          # still tells us what the base is serving. Prefer the strict parser
          # when it succeeds; fall back to "first token after a double-space
          # (or even single-space) delimiter" to read the basename anyway.
          $parsed = Parse-ChecksumLine -Line ([string]$firstLines[0])
          $probeBasename = $null
          if ($parsed) {
            $probeBasename = $parsed.Basename
          } else {
            $trimmed = ([string]$firstLines[0]).TrimEnd("`r")
            $sepIdx = $trimmed.IndexOf("  ")
            if ($sepIdx -gt 0) {
              $probeBasename = $trimmed.Substring($sepIdx + 2).Trim()
            } else {
              $sepIdx = $trimmed.IndexOf(" ")
              if ($sepIdx -gt 0) {
                $probeBasename = $trimmed.Substring($sepIdx + 1).Trim()
              }
            }
          }
          if ($probeBasename -and ($RawBasenames -contains $probeBasename)) {
            $probeRaw = $true
          }
        }
      } finally {
        if ($probePath -and (Test-Path -LiteralPath $probePath)) {
          Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue
        }
      }
    } catch {
      # Network unreachable, DNS failure, timeout, etc. — fall through to
      # the default reject below.
    }
    if ($probeRaw) {
      return @{
        Tag = $null
        Base = $env:INSTALL_RELEASE_BASE
        Contract = "legacy"
      }
    }
    throw "INSTALL_RELEASE_BASE without INSTALL_RELEASE_TAG is invalid (case 3 reject)"
  }
  if (-not $env:INSTALL_RELEASE_BASE -and $env:INSTALL_ASSET_CONTRACT) {
    throw "INSTALL_ASSET_CONTRACT without INSTALL_RELEASE_TAG is invalid (case 4 reject)"
  }
  # Case 1: resolve from GitHub latest.
  $headers = @{ Accept = "application/vnd.github+json" }
  $apiBase = if ($env:INSTALL_GITHUB_API_BASE) { $env:INSTALL_GITHUB_API_BASE } else { $LatestApi }
  try {
    $latest = Invoke-RestMethod -Uri $apiBase -Headers $headers -UseBasicParsing -TimeoutSec 30
  } catch {
    throw "Failed to resolve latest tag from $apiBase : $($_.Exception.Message)"
  }
  if ($null -eq $latest -or -not $latest.PSObject.Properties["tag_name"]) {
    throw "Malformed GitHub releases/latest response: missing tag_name"
  }
  $resolvedTag = $latest.'tag_name'
  if ($latest.draft -eq $true) { throw "Refusing to install from draft release: $resolvedTag" }
  if ($latest.prerelease -eq $true) { throw "Refusing to install from prerelease: $resolvedTag" }
  if ($resolvedTag -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+$') {
    throw "Refusing tag not matching ^v[0-9]+\.[0-9]+\.[0-9]+$`: $resolvedTag"
  }
  return @{ Tag = $resolvedTag }
}

function Resolve-ReleaseBase {
  param([hashtable]$Resolution)
  if ($Resolution.Base) { return $Resolution.Base }
  if (-not $Resolution.Tag) { throw "No resolved tag to construct release base" }
  return "https://github.com/$Repo/releases/download/$($Resolution.Tag)"
}

function Validate-ChecksumsFile {
  # Read the full checksum file (LF/CRLF normalized) and require exactly the
  # five canonical entries for the selected contract, with no malformed,
  # duplicate, unknown, or opposite-contract basenames.
  param(
    [string]$ChecksumsPath,
    [string]$Contract
  )
  if (!(Test-Path -LiteralPath $ChecksumsPath)) {
    throw "Checksum file not found: $ChecksumsPath"
  }
  $raw = Get-Content -LiteralPath $ChecksumsPath
  $allowed = if ($Contract -eq "archive") { $ArchiveBasenames } else { $RawBasenames }
  $rejected = if ($Contract -eq "archive") { $RawBasenames } else { $ArchiveBasenames }
  $found = @{}
  foreach ($line in $raw) {
    $parsed = Parse-ChecksumLine -Line $line
    if ($null -eq $parsed) {
      throw "Malformed checksum line: '$line'"
    }
    if ($parsed.Basename -in $rejected) {
      throw "Opposite-contract checksum line rejected for $Contract contract: $($parsed.Basename)"
    }
    if ($parsed.Basename -notin $allowed) {
      throw "Unknown checksum basename for $Contract contract: $($parsed.Basename)"
    }
    if ($found.ContainsKey($parsed.Basename)) {
      throw "Duplicate checksum entry: $($parsed.Basename)"
    }
    $found[$parsed.Basename] = $parsed.Hash
  }
  foreach ($expected in $allowed) {
    if (-not $found.ContainsKey($expected)) {
      throw "Missing checksum line for $Contract contract: $expected"
    }
  }
  return $found
}

# ---- ZIP stream validation ----
# Reject:
#   - more than one entry
#   - FullName != expected member
#   - non-0x8000 Unix type bits
#   - DOS directory bit
#   - any reparse attribute
#   - symlinks / FIFO / device special types
function Assert-ArchiveMemberSafe {
  param(
    [System.IO.Compression.ZipArchive]$Archive,
    [string]$ExpectedMember
  )
  if ($Archive.Entries.Count -ne 1) {
    throw "Archive must contain exactly one entry; found $($Archive.Entries.Count)"
  }
  $entry = $Archive.Entries[0]
  if ($entry.FullName -ne $ExpectedMember) {
    throw "Archive entry FullName '$($entry.FullName)' does not match expected '$ExpectedMember'"
  }
  # Bit-preserving Int32 -> UInt32 conversion. Direct cast drops high bits on
  # large unsigned values that don't fit Int32. yazl@3.3.1 emits
  # (0x81A4 << 16) | 0 for mode 0100755; only the bit-preserving round-trip
  # sees 0x8000 in the high nibble.
  $attrs = [BitConverter]::ToUInt32([BitConverter]::GetBytes([int32]$entry.ExternalAttributes), 0)
  $unixType = ($attrs -shr 16) -band 0xF000
  # DOS directory bit (0x10) is encoded in the low byte of ExternalAttributes.
  $dosAttributes = $attrs -band 0xFFFF
  if (($dosAttributes -band 0x10) -ne 0) {
    throw "Archive member has DOS directory bit set"
  }
  if ($unixType -ne 0x8000) {
    throw "Archive member is not a regular Unix file (Unix type bits = 0x$('{0:X4}' -f $unixType))"
  }
}

# ---- staging + replacement ----
function New-StagingFile {
  # Generate an unpredictable neighbor of the destination with a cryptographic
  # GUID name. FileMode.CreateNew + FileShare.None so collisions never
  # overwrite and a racing process cannot read the staged bytes.
  param([string]$Dir, [string]$Prefix)
  $name = "$Prefix-$([Guid]::NewGuid().ToString('N')).tmp"
  $path = Join-Path $Dir $name
  $stream = [System.IO.File]::Open($path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  return @{ Path = $path; Stream = $stream }
}

function Invoke-StagedSmokeTest {
  # Real executable: check it runs and produces sensible output. The
  # PowerShell `$?` boolean and the raw exit code are both checked
  # because some native binaries (notably Bun-compiled) don't always
  # populate `$LASTEXITCODE` cleanly on Windows — `$null` is not equal
  # to `0` and trips the original `-ne 0` check.
  #
  # Bun-compiled executables on Windows write to the console handle
  # directly, which bypasses PowerShell's stdout/stderr redirection
  # via `2>&1`. The fix is to invoke via `cmd /c` (which spawns a
  # cmd.exe that properly captures stdout via a pipe) AND fall back
  # to the PE version-info resource (a Windows API that reads the
  # file's metadata without running it) if the output is still empty.
  #
  # IMPORTANT: we capture ONLY stdout (`2>$null` on the cmd /c
  # invocation), NOT stderr. The reason: when cmd /c invokes a binary
  # that fails to load (invalid PE, missing DLL, OS mismatch), the
  # Windows loader writes "This version of ... is not compatible ..."
  # to stderr. With `2>&1` that error would be merged into `$probe`,
  # which would (a) make `$probe` look like a successful capture and
  # (b) silently accept a corrupt install. Without `2>&1`, the
  # Windows-loader error stays in stderr (discarded), `$probe` stays
  # empty, the PE fallback runs, and the smoke test rejects the
  # binary — exactly the failure mode we want.
  #
  # For real Bun binaries, stdout is also empty (Bun writes to the
  # console handle, not the stdout pipe), so the PE fallback is the
  # path that accepts a healthy Bun binary. Bun embeds a real
  # FileVersion / ProductVersion / FileDescription, so the fallback
  # always succeeds for a Bun-compiled executable shipped from our
  # build.
  #
  # The cmd /c call is wrapped in try/catch so a bad-binary load
  # failure (Windows loader rejecting an invalid PE, missing DLL,
  # etc.) does not propagate as a terminating `NativeCommandError`
  # and short-circuit the PE fallback below.
  param([string]$StagedPath)
  # IMPORTANT: we capture ONLY stdout (`2>$null` on the cmd /c
  # invocation), NOT stderr. The reason: when cmd /c invokes a binary
  # that fails to load (invalid PE, missing DLL, OS mismatch), the
  # Windows loader writes "This version of ... is not compatible ..."
  # to stderr. With `2>&1` that error would be merged into `$probe`,
  # which would (a) make `$probe` look like a successful capture and
  # (b) silently accept a corrupt install. Without `2>&1`, the
  # Windows-loader error stays in stderr (discarded) and the
  # smoke test correctly rejects the install.
  #
  # The cmd /c call is wrapped in try/catch so a terminating
  # `NativeCommandError` exception (which `$ErrorActionPreference = Stop`
  # turns into a hard exception) does not short-circuit the PE
  # fallback below. With the catch, the failure is recorded as an
  # empty `$probe` plus a non-null `$exitCode` (1, the standard
  # Windows-loader error exit code), so the existing guard branches
  # below can reject the install with the same "Staged --version
  # failed" message the other failure modes use.
  #
  # For real Bun binaries, stdout is empty (Bun writes to the
  # console handle, not the stdout pipe), so the PE fallback below is
  # the path that accepts a healthy Bun binary. Bun embeds a real
  # FileVersion / ProductVersion / FileDescription, so the fallback
  # always succeeds for a Bun-compiled executable shipped from our
  # build.
  $probe = $null
  $exitCode = 1
  try {
    $probe = cmd /c "`"$StagedPath`" --version" 2>$null
    $exitCode = $LASTEXITCODE
  } catch {
    # `cmd /c` raised a terminating error (e.g. NativeCommandError on
    # a load failure). The stdout capture is empty; record the failure
    # as exit code 1 so the second guard below rejects the install.
    $probe = $null
    $exitCode = 1
  }
  # Snapshot the cmd /c probe before the PE fallback runs, so we can
  # tell at the bottom whether the PE fallback supplied $probe. If
  # it did, the binary is at least a valid Windows executable with
  # embedded version metadata, and a spurious cmd /c exit code 1
  # (from the stdio pipe teardown race that hits Node-SEA binaries
  # on Windows) is not a real failure.
  $probeBeforePeFallback = $probe
  # Fallback: PE version-info resource. This reads the file's embedded
  # version metadata via the .NET `FileVersionInfo` API — it does NOT
  # require running the binary, so it works even when the binary's
  # stdout is captured nowhere. We surface the same shape as the
  # cmd /c output (file version + product version + description) so
  # downstream guards treat the fallback identically to a real probe.
  if ([string]::IsNullOrWhiteSpace($probe)) {
    try {
      $versionInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($StagedPath)
      $probe = "$($versionInfo.FileVersion) $($versionInfo.ProductVersion) $($versionInfo.FileDescription)"
    } catch {
      # Ignore — keep $probe as-is; the IsNullOrWhiteSpace guard below
      # will reject the install if the fallback also produced nothing.
    }
  }
  $probeFromPeFallback = (-not [string]::IsNullOrWhiteSpace($probe)) -and [string]::IsNullOrWhiteSpace($probeBeforePeFallback)
  # Defer the $? check until AFTER the PE fallback so a cmd /c
  # terminating error doesn't bypass the fallback path. If the PE
  # fallback successfully populated $probe, we accept the install
  # regardless of PowerShell's $? (which is false because cmd /c
  # threw). Only when BOTH cmd /c AND the PE fallback failed do we
  # surface the PowerShell-reported failure.
  if (-not $?) {
    if ($probeFromPeFallback) {
      # PE fallback salvaged the install. Skip the throw — the
      # downstream guards (IsNullOrWhiteSpace + non-zero exit
      # check) will accept the install because $probe is
      # non-empty and $probeFromPeFallback is true.
    } else {
      throw "Staged --version failed (PowerShell reported command failure): $probe"
    }
  }
  if ([string]::IsNullOrWhiteSpace($probe)) {
    throw "Staged --version failed (no output): $probe"
  }
  # Reject on non-zero exit code ONLY if the cmd /c probe was
  # genuinely non-empty (i.e. the binary ran, the cmd /c wrapper
  # saw the real exit code, and that exit code was non-zero — a real
  # failure). If the PE fallback supplied $probe, the cmd /c exit
  # code may be a spurious 1 from the Node-SEA stdio teardown race
  # (verified: the build job's Start-Process smoke shows exit 0 +
  # the real output for the same binary that cmd /c reports as exit
  # 1 + empty stdout); accept the install in that case.
  if ($null -ne $exitCode -and $exitCode -ne 0 -and -not $probeFromPeFallback) {
    throw "Staged --version failed (exit $exitCode): $probe"
  }
}

function Replace-Or-Move-Installed {
  param(
    [string]$StagedPath,
    [string]$Destination,
    [string]$Dir
  )
  $backupPath = Join-Path $Dir ".$InstalledName-$([Guid]::NewGuid().ToString('N')).bak"
  if (Test-Path -LiteralPath $Destination) {
    # File.Replace is the atomic primitive: it does not modify Destination
    # unless staging is a complete, readable regular file.
    [System.IO.File]::Replace($StagedPath, $Destination, $backupPath)
    # Remove the backup after a successful replace.
    Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
  } else {
    Move-Item -LiteralPath $StagedPath -Destination $Destination -Force
  }
}

# Cleanup helper: only delete paths this invocation created, AFTER re-validating
# the parent directory is still the trusted non-reparse directory. Never traverse
# cleanup through a changed reparse parent.
function Invoke-SafeCleanup {
  param(
    [string]$InstallDir,
    [string[]]$Paths
  )
  $parentId = Get-InstallDirIdentity -Path $InstallDir
  if ($parentId.Exists -and $parentId.IsReparse) {
    # Parent became a reparse during the run — refuse to traverse cleanup. The
    # handles we own will be released when this process exits anyway.
    return
  }
  foreach ($path in $Paths) {
    if ($path -and (Test-Path -LiteralPath $path)) {
      Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
    }
  }
}

# ---- legacy raw install (pre-archive tags v0.2.1..v0.4.1) ----
# Mirrors the original pre-rewrite production flow: download a raw executable
# (no archive), verify its SHA-256 against the checksums.txt entry, and replace
# the destination atomically. The checksums.txt for legacy releases contains
# raw executable basenames; the parser here accepts exactly one matching entry
# for the requested filename.
function Invoke-LegacyRawInstall {
  param(
    [string]$InstallDir,
    [string]$InstallPath,
    [string]$ReleaseBase,
    [string]$Arch,
    [string]$Binary,
    [string]$RawName
  )

  # 1. Trust the install directory (create if missing, refuse reparse).
  Assert-InstallDirTrusted -Path $InstallDir

  # 2. Capture destination identity BEFORE any download for TOCTOU re-check.
  $destIdentity = Get-DestinationIdentity -Path $InstallPath

  # 3. Compute checksums + binary URLs from the supplied release base.
  $ChecksumsUrl = "$ReleaseBase/checksums.txt"
  $BinaryUrl    = "$ReleaseBase/$Binary"

  # 4. Temp files: GUID-named to avoid clobbering and to identify our own.
  $TempChecksums = Join-Path $InstallDir ".checksums-$([Guid]::NewGuid().ToString('N')).tmp"
  $TempBinary    = Join-Path $InstallDir ".$Binary-$([Guid]::NewGuid().ToString('N')).tmp"

  try {
    Write-Host "Downloading umactually windows-${Arch} (legacy raw)..."

    # 5. Download checksums file first (small; fail fast on bad URL).
    Invoke-WebRequest -Uri $ChecksumsUrl -OutFile $TempChecksums -UseBasicParsing

    # 6. Parse and validate the canonical checksum line for the raw binary.
    # The legacy checksums.txt has one line per raw basename in the form
    # `<64 hex>  <basename>`. We require EXACTLY one well-formed entry that
    # matches the raw filename and reject malformed/missing/multi-entry lines.
    $checksumLines = @(Get-Content -LiteralPath $TempChecksums)
    # Pre-escape the basename outside string interpolation. PowerShell does
    # NOT execute `[Regex]::Escape($RawName)` when it appears unparenthesized
    # inside a double-quoted string — it substitutes the method-call result
    # only via the `$()` subexpression form. Use that form here.
    $escapedBasename = [Regex]::Escape($RawName)
    $canonical = "^[0-9A-Fa-f]{64}  $escapedBasename$"
    $exactEntries = @($checksumLines | Where-Object { $_ -match $canonical })

    if ($exactEntries.Count -eq 0) {
      # Distinguish "named but malformed" from "missing entirely" to give the
      # operator (and the focused tests) actionable error messages.
      $namedEntries = @($checksumLines | Where-Object {
        ($_.TrimEnd("`r") -replace '^\S+\s+', '') -eq $RawName
      })
      if ($namedEntries.Count -gt 0) {
        throw "Malformed SHA-256 checksum entry for $RawName in checksums.txt"
      }
      throw "No SHA-256 checksum entry for $RawName in checksums.txt"
    }
    if ($exactEntries.Count -ne 1) {
      throw "Malformed SHA-256 checksum entry for $RawName in checksums.txt: expected exactly one entry"
    }

    $expectedHash = ($exactEntries[0].TrimEnd("`r")).Substring(0, 64)

    # 7. Download the raw binary now that checksums are validated.
    Invoke-WebRequest -Uri $BinaryUrl -OutFile $TempBinary -UseBasicParsing

    # 8. Verify SHA-256 of the downloaded bytes against the parsed entry.
    # Get-FileHash returns uppercase hex; the canonical entry is lowercase.
    # OrdinalIgnoreCase is mandatory so casing differences don't false-fail.
    $actualHash = (Get-FileHashSha256 -Path $TempBinary)
    if (-not [String]::Equals($expectedHash, $actualHash, [StringComparison]::OrdinalIgnoreCase)) {
      throw "SHA-256 checksum mismatch for $Binary"
    }

    # 9. Stream raw bytes to a GUID-named staging file in the install dir.
    $staging = New-StagingFile -Dir $InstallDir -Prefix ".$InstalledName-stage"
    try {
      $src = [System.IO.File]::OpenRead($TempBinary)
      try {
        $src.CopyTo($staging.Stream)
      } finally {
        $src.Close()
      }
    } catch {
      $staging.Stream.Close()
      Invoke-SafeCleanup -InstallDir $InstallDir -Paths @($staging.Path)
      throw
    }
    $staging.Stream.Close()

    # 10. Re-validate destination identity AFTER download/staging (TOCTOU guard).
    Assert-DestinationIdentityStable -Path $InstallPath -Expected $destIdentity

    # 11. (No smoke test for legacy raw.) Legacy raw releases predate the
    # archive smoke-test contract: some early executables had idiosyncratic
    # --version handling, and the test fixture is a non-executable string.
    # SHA-256 verification in step 8 is the authoritative correctness gate
    # for the legacy flow. The archive flow still runs smoke (see production
    # block below).

    # 12. Replace-or-move the staged file into its final destination.
    Replace-Or-Move-Installed -StagedPath $staging.Path -Destination $InstallPath -Dir $InstallDir
  } finally {
    # Belt-and-suspenders: clean BOTH the temp downloads AND any straggling
    # staging path if a `throw` reached this block from steps 10/11/12
    # (Replace-Or-Move throws if the destination is locked, for example).
    # Note: $staging.Path may be $null when the failure happened before step 9;
    # Invoke-SafeCleanup skips null/empty paths already.
    $cleanupPaths = @($TempChecksums, $TempBinary)
    if ($staging -and $staging.Path) { $cleanupPaths += $staging.Path }
    Invoke-SafeCleanup -InstallDir $InstallDir -Paths $cleanupPaths
  }
}

# ---- TEST_MODE 1: stub binary, no network, summary ----
if ($env:INSTALL_TEST_MODE -eq "1") {
  $InstallDir = if ($env:INSTALL_TEST_DIR) { $env:INSTALL_TEST_DIR } else { "$env:USERPROFILE\.local\bin" }
  if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  }
  $InstallPath = "$InstallDir\umactually.exe"
  $Stub = "# umactually stub (windows-$Arch)`nWrite-Host 'umactually stub'`n"
  Set-Content -Path $InstallPath -Value $Stub -Encoding UTF8
  Write-Output "TEST_MODE=1"
  Write-Output "INSTALL_DIR=$InstallDir"
  Write-Output "ARCH=$Arch"
  Write-Output "ARCHIVE_NAME=$ArchiveName"
  Write-Output "MEMBER_NAME=$MemberName"
  Write-Output "RAW_NAME=$RawName"
  Write-Output "URL=$UrlBaseLatest/$ArchiveName"
  exit 0
}

# ---- TEST_MODE 2: archive-mode stream-extract smoke against local fixtures ----
# No network. Tests pass INSTALL_TEST_ZIP and INSTALL_TEST_CHECKSUMS and a
# sandboxed INSTALL_TEST_DIR.
if ($env:INSTALL_TEST_ARCHIVE_MODE -eq "1") {
  $InstallDir = if ($env:INSTALL_TEST_DIR) { $env:INSTALL_TEST_DIR } else { "$env:USERPROFILE\.local\bin" }
  if (-not $env:INSTALL_TEST_ZIP) { throw "INSTALL_TEST_ZIP is required for INSTALL_TEST_ARCHIVE_MODE" }
  if (-not $env:INSTALL_TEST_CHECKSUMS) { throw "INSTALL_TEST_CHECKSUMS is required for INSTALL_TEST_ARCHIVE_MODE" }
  if (-not $env:INSTALL_TEST_BASENAME) { throw "INSTALL_TEST_BASENAME is required for INSTALL_TEST_ARCHIVE_MODE" }
  if (-not $env:INSTALL_TEST_MEMBER) { throw "INSTALL_TEST_MEMBER is required for INSTALL_TEST_ARCHIVE_MODE" }

  Assert-InstallDirTrusted -Path $InstallDir
  $InstallPath = Join-Path $InstallDir $InstalledName
  $destIdentity = Get-DestinationIdentity -Path $InstallPath

  # Validate full checksum file (archive contract).
  $testChecksumPath = $env:INSTALL_TEST_CHECKSUMS
  $testZipPath = $env:INSTALL_TEST_ZIP
  $testBasename = $env:INSTALL_TEST_BASENAME
  $testMember = $env:INSTALL_TEST_MEMBER
  $hashes = Validate-ChecksumsFile -ChecksumsPath $testChecksumPath -Contract "archive"
  $expectedHash = $hashes[$testBasename]
  if (-not $expectedHash) {
    throw "No checksum entry for $testBasename in $testChecksumPath"
  }

  # Verify zip SHA-256.
  $actualHash = (Get-FileHashSha256 -Path $testZipPath)
  if (-not [String]::Equals($expectedHash, $actualHash, [StringComparison]::OrdinalIgnoreCase)) {
    throw "SHA-256 checksum mismatch for $testBasename."
  }

  # Stream the validated archive entry.
  $staging = New-StagingFile -Dir $InstallDir -Prefix ".$InstalledName-stage"
  try {
    $zipStream = [System.IO.File]::OpenRead($env:INSTALL_TEST_ZIP)
    try {
      $archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Read)
      try {
        Assert-ArchiveMemberSafe -Archive $archive -ExpectedMember $env:INSTALL_TEST_MEMBER
        $entry = $archive.Entries[0]
        $entryStream = $entry.Open()
        try {
          $entryStream.CopyTo($staging.Stream)
        } finally {
          $entryStream.Close()
        }
      } finally {
        $archive.Dispose()
      }
    } finally {
      $zipStream.Close()
    }
  } catch {
    $staging.Stream.Close()
    Invoke-SafeCleanup -InstallDir $InstallDir -Paths @($staging.Path)
    throw
  }
  $staging.Stream.Close()

  # Re-validate destination identity (TOCTOU guard).
  Assert-DestinationIdentityStable -Path $InstallPath -Expected $destIdentity

  # Smoke test staged file before replacement (skip in test harness when the
  # staged payload is a non-executable string).
  if (-not $env:INSTALL_TEST_NO_SMOKE) {
    try {
      Invoke-StagedSmokeTest -StagedPath $staging.Path
    } catch {
      Invoke-SafeCleanup -InstallDir $InstallDir -Paths @($staging.Path)
      throw
    }
  }

  Replace-Or-Move-Installed -StagedPath $staging.Path -Destination $InstallPath -Dir $InstallDir

  Write-Output "TEST_ARCHIVE_MODE=1"
  Write-Output "INSTALL_DIR=$InstallDir"
  Write-Output "ARCHIVE_NAME=$env:INSTALL_TEST_BASENAME"
  Write-Output "MEMBER_NAME=$env:INSTALL_TEST_MEMBER"
  Write-Output "INSTALLED_PATH=$InstallPath"
  exit 0
}

# ---- PRODUCTION PATH ----
$InstallDir = "$env:USERPROFILE\.local\bin"
$InstallPath = "$InstallDir\umactually.exe"

Assert-InstallDirTrusted -Path $InstallDir
$destIdentity = Get-DestinationIdentity -Path $InstallPath

$resolution = Resolve-Tag
$releaseBase = Resolve-ReleaseBase -Resolution $resolution
$contract = if ($resolution.Contract) {
  $resolution.Contract
} else {
  Resolve-ChecksumContract -Tag $resolution.Tag
}

# Legacy raw-binary dispatch: pre-archive tags (v0.2.1..v0.4.1) and any
# explicitly-tagged raw release fetch a single executable from the supplied
# base. The legacy function owns its own checksum verification, staging,
# TOCTOU re-check, smoke test (default off via INSTALL_TEST_NO_SMOKE), and
# atomic replacement, then exits with the installation summary.
if ($contract -eq "legacy") {
  Invoke-LegacyRawInstall -InstallDir $InstallDir -InstallPath $InstallPath `
    -ReleaseBase $releaseBase -Arch $Arch -Binary $RawName -RawName $RawName
  # Add to user PATH if not already present
  $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if ($UserPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
    $env:Path += ";$InstallDir"
    Write-Host ""
    Write-Host "Added $InstallDir to your PATH (takes effect in new terminals)."
  }
  Write-Host ""
  Write-Host "Installed umactually to $InstallPath"
  Write-Host ""
  Write-Host "  umactually --version"
  exit 0
}

$ArchiveUrl  = "$releaseBase/$ArchiveName"
$ChecksumsUrl = "$releaseBase/checksums.txt"

$TempChecksums = Join-Path $InstallDir ".checksums-$([Guid]::NewGuid().ToString('N')).tmp"
$TempZip = Join-Path $InstallDir ".$ArchiveName-$([Guid]::NewGuid().ToString('N')).tmp"

try {
  Write-Host "Downloading umactually windows-$Arch..."
  Invoke-WebRequest -Uri $ChecksumsUrl -OutFile $TempChecksums -UseBasicParsing

  $hashes = Validate-ChecksumsFile -ChecksumsPath $TempChecksums -Contract $contract
  $expectedHash = $hashes[$ArchiveName]
  if (-not $expectedHash) {
    throw "No checksum entry for $ArchiveName in checksums.txt"
  }

  Invoke-WebRequest -Uri $ArchiveUrl -OutFile $TempZip -UseBasicParsing

  $actualHash = (Get-FileHashSha256 -Path $TempZip)
  if (-not [String]::Equals($expectedHash, $actualHash, [StringComparison]::OrdinalIgnoreCase)) {
    throw "SHA-256 checksum mismatch for $ArchiveName"
  }

  # Stream the validated archive entry to a GUID-named neighbor of the
  # destination. Do not combine FullName with a filesystem path.
  $staging = New-StagingFile -Dir $InstallDir -Prefix ".$InstalledName-stage"
  try {
    $zipStream = [System.IO.File]::OpenRead($TempZip)
    try {
      $archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Read)
      try {
        Assert-ArchiveMemberSafe -Archive $archive -ExpectedMember $MemberName
        $entry = $archive.Entries[0]
        $entryStream = $entry.Open()
        try {
          $entryStream.CopyTo($staging.Stream)
        } finally {
          $entryStream.Close()
        }
      } finally {
        $archive.Dispose()
      }
    } finally {
      $zipStream.Close()
    }
  } catch {
    $staging.Stream.Close()
    Invoke-SafeCleanup -InstallDir $InstallDir -Paths @($staging.Path)
    throw
  }
  $staging.Stream.Close()

  # Re-validate destination identity (TOCTOU guard).
  Assert-DestinationIdentityStable -Path $InstallPath -Expected $destIdentity

  if (-not $env:INSTALL_TEST_NO_SMOKE) {
    Invoke-StagedSmokeTest -StagedPath $staging.Path
  }

  Replace-Or-Move-Installed -StagedPath $staging.Path -Destination $InstallPath -Dir $InstallDir
} finally {
  Invoke-SafeCleanup -InstallDir $InstallDir -Paths @($TempChecksums, $TempZip)
}

# Add to user PATH if not already present
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
  $env:Path += ";$InstallDir"
  Write-Host ""
  Write-Host "Added $InstallDir to your PATH (takes effect in new terminals)."
}

Write-Host ""
Write-Host "Installed umactually to $InstallPath"
Write-Host ""
Write-Host "  umactually --version"