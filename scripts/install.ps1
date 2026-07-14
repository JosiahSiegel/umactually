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

$Repo = "JosiahSiegel/umactually"
$UrlBase = "https://github.com/$Repo/releases/latest/download"

# Detect architecture. On Windows pwsh reports AMD64/ARM64; on
# Linux/macOS pwsh reports x86_64/arm64 (lowercase). Normalize
# case-insensitively so the test suite (which runs pwsh on Linux CI)
# does not throw "Unsupported architecture".
$Arch = switch ($true) {
  (($env:PROCESSOR_ARCHITECTURE -ieq "AMD64") -or ($env:PROCESSOR_ARCHITECTURE -ieq "x86_64"))   { "x64" }
  (($env:PROCESSOR_ARCHITECTURE -ieq "ARM64") -or ($env:PROCESSOR_ARCHITECTURE -ieq "arm64"))   { "arm64" }
  default   { Write-Error "Unsupported architecture: $env:PROCESSOR_ARCHITECTURE"; exit 1 }
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

Write-Host "Downloading umactually windows-${Arch}..."
Invoke-WebRequest -Uri $Url -OutFile $InstallPath -UseBasicParsing

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