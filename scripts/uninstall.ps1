# SPDX-License-Identifier: MIT
# Uninstaller for umactually standalone binary (Windows).
#
# Usage (PowerShell):
#   irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/uninstall.ps1 | iex
#
# Test mode (used by test/unit/install-scripts-powershell.test.ts):
#   $env:UNINSTALL_TEST_MODE=1; $env:UNINSTALL_TEST_DIR="C:\temp\sandbox"; ./uninstall.ps1

$ErrorActionPreference = "Stop"

# Test-mode path
if ($env:UNINSTALL_TEST_MODE -eq "1") {
  $TestDir = if ($env:UNINSTALL_TEST_DIR) { $env:UNINSTALL_TEST_DIR } else { "$env:USERPROFILE\.local\bin" }
  $TestPath = "$TestDir\umactually.exe"
  $Found = 0
  $Removed = 0
  if (Test-Path $TestPath) {
    $Found = 1
    Remove-Item $TestPath -Force
    $Removed = 1
  }
  Write-Output "TEST_MODE=1"
  Write-Output "TEST_DIR=$TestDir"
  Write-Output "FOUND=$Found"
  Write-Output "REMOVED=$Removed"
  exit 0
}

$InstallPath = "$env:USERPROFILE\.local\bin\umactually.exe"

if (Test-Path $InstallPath) {
  Remove-Item $InstallPath -Force
  Write-Host "Removed $InstallPath"
} else {
  Write-Host "umactually binary not found at $InstallPath"
}

# Remove from user PATH (only the umactually segment)
$InstallDir = "$env:USERPROFILE\.local\bin"
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -like "*$InstallDir*") {
  $Cleaned = ($UserPath -split ";" | Where-Object { $_ -ne $InstallDir -and $_ -ne "" }) -join ";"
  [Environment]::SetEnvironmentVariable("Path", $Cleaned, "User")
  Write-Host "Removed $InstallDir from PATH"
}

# Check if anything remains
$Remaining = Get-Command umactually -ErrorAction SilentlyContinue
if ($Remaining) {
  Write-Host ""
  Write-Host "Warning: 'umactually' is still on your PATH at: $($Remaining.Source)"
  Write-Host "This may be an npm global install. Run: npm uninstall -g umactually"
} else {
  Write-Host ""
  Write-Host "umactually has been removed."
}