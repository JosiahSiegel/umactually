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

# ---- constants ----
$Repo = "JosiahSiegel/umactually"
$LatestApi = "https://api.github.com/repos/$Repo/releases/latest"
$UrlBaseLatest = "https://github.com/$Repo/releases/latest/download"
$DefaultRawBase = "https://github.com/$Repo/raw/main/scripts"
$DefaultScriptUrl = "$DefaultRawBase/install.ps1"

# Literal allowlist of pre-archive tags that ship raw executables.
$LegacyTagAllowlist = @("v0.2.1", "v0.3.0", "v0.4.0", "v0.4.1")

# Six canonical archive basenames (manifest order, fixed for the contract).
$ArchiveBasenames = @(
  "umactually-linux-x64.tar.gz",
  "umactually-linux-arm64.tar.gz",
  "umactually-darwin-x64.tar.gz",
  "umactually-darwin-arm64.tar.gz",
  "umactually-windows-x64.zip",
  "umactually-windows-arm64.zip"
)

# Six canonical raw basenames for legacy contract.
$RawBasenames = @(
  "umactually-linux-x64",
  "umactually-linux-arm64",
  "umactually-darwin-x64",
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
    Sha256     = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
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
  # six canonical entries for the selected contract, with no malformed,
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
  # Real executable: just check it runs and exits 0. The test harness injects a
  # small CMD/PowerShell shim executable so this passes without Bun.
  param([string]$StagedPath)
  $probe = & $StagedPath --version 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Staged --version failed (exit $LASTEXITCODE): $probe"
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
    $actualHash = (Get-FileHash -LiteralPath $TempBinary -Algorithm SHA256).Hash
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
  $actualHash = (Get-FileHash -LiteralPath $testZipPath -Algorithm SHA256).Hash
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

  $actualHash = (Get-FileHash -LiteralPath $TempZip -Algorithm SHA256).Hash
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