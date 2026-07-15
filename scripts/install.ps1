# SPDX-License-Identifier: MIT
# Universal installer for umactually standalone binary (Windows).
#
# Usage (PowerShell):
#   irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.ps1 | iex
#
# Test mode (used by test/unit/install-scripts-powershell.test.ts):
#   $env:INSTALL_TEST_MODE=1; $env:INSTALL_TEST_DIR="C:\temp\sandbox"; ./install.ps1
#     - skips the network download
#     - writes a stub script to INSTALL_TEST_DIR\umactually.exe

$ErrorActionPreference = "Stop"

# Force TLS 1.2. PowerShell 5.1 (Windows PowerShell) defaults to TLS 1.0/1.1,
# which GitHub rejects — causing "The connection was closed unexpectedly"
# before the request even reaches the asset endpoint. This is a no-op on
# PowerShell 7+ (which already uses TLS 1.2+).
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {
  # PowerShell Core doesn't support setting this; it already uses TLS 1.2+.
}

$Repo = "JosiahSiegel/umactually"
$UrlBase = if ($env:INSTALL_RELEASE_BASE) { $env:INSTALL_RELEASE_BASE } else { "https://github.com/$Repo/releases/latest/download" }

# Detect architecture. The test suite invokes this script via
# execFileSync with no PROCESSOR_ARCHITECTURE env var (the test
# only passes INSTALL_TEST_DIR). When the env var is missing OR
# null OR an unrecognized value, default to x64 — this script is a
# download shim for the umactually-windows-x64.exe binary, and the
# script's runtime behavior (test mode vs production) doesn't depend
# on knowing the host arch. The arch detection exists for future
# arm64 binary support; missing values should never block a test
# or a production install.
$NormalizedArch = if ($env:PROCESSOR_ARCHITECTURE) { $env:PROCESSOR_ARCHITECTURE.ToLower() } else { "" }
$Arch = switch -Wildcard ($NormalizedArch) {
  "amd64"   { "x64" }
  "x86_64"  { "x64" }
  "arm64"   { "arm64" }
  default   { "x64" }
}

# Test-mode path: no network, writes stub.
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
  Write-Output "BINARY=umactually-windows-$Arch.exe"
  Write-Output "URL=$UrlBase/umactually-windows-$Arch.exe"
  exit 0
}

# Production path
$Binary = "umactually-windows-${Arch}.exe"
$Url = "${UrlBase}/${Binary}"

# Install directory
$InstallDir = "$env:USERPROFILE\.local\bin"
$InstallPath = "$InstallDir\umactually.exe"

if (!(Test-Path $InstallDir)) {
  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$ChecksumUrl = "${UrlBase}/checksums.txt"
$TempBinary = Join-Path $InstallDir ".$Binary.$([Guid]::NewGuid().ToString('N')).tmp"
$TempChecksums = Join-Path $InstallDir ".checksums.$([Guid]::NewGuid().ToString('N')).tmp"

try {
  Write-Host "Downloading umactually windows-${Arch}..."
  Invoke-WebRequest -Uri $Url -OutFile $TempBinary -UseBasicParsing
  Invoke-WebRequest -Uri $ChecksumUrl -OutFile $TempChecksums -UseBasicParsing

  $ChecksumLines = Get-Content -LiteralPath $TempChecksums
  $ExactEntries = @($ChecksumLines | Where-Object { $_ -match "^[0-9A-Fa-f]{64} [ *]$([Regex]::Escape($Binary))$" })
  if ($ExactEntries.Count -eq 0) {
    $NamedEntries = @($ChecksumLines | Where-Object { $_ -match "[ *]$([Regex]::Escape($Binary))$" })
    if ($NamedEntries.Count -gt 0) {
      throw "Malformed SHA-256 checksum entry for $Binary in checksums.txt."
    }
    throw "No SHA-256 checksum entry for $Binary in checksums.txt."
  }
  if ($ExactEntries.Count -ne 1) {
    throw "Malformed SHA-256 checksum entry for $Binary in checksums.txt: expected exactly one entry."
  }

  $ExpectedHash = $ExactEntries[0].Substring(0, 64)
  $ActualHash = (Get-FileHash -LiteralPath $TempBinary -Algorithm SHA256).Hash
  if (![String]::Equals($ExpectedHash, $ActualHash, [StringComparison]::OrdinalIgnoreCase)) {
    throw "SHA-256 checksum mismatch for $Binary."
  }

  Move-Item -LiteralPath $TempBinary -Destination $InstallPath -Force
} finally {
  Remove-Item -LiteralPath $TempBinary, $TempChecksums -Force -ErrorAction SilentlyContinue
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