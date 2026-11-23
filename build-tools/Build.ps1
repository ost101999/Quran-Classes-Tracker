$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
& (Join-Path $root 'desktop-app\build-tools\Build.ps1') @args
exit $LASTEXITCODE
