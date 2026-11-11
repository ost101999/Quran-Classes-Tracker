$ErrorActionPreference = 'Stop'
$tools = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$root = [IO.Path]::GetFullPath((Split-Path -Parent $tools))

try {
    Set-Location -LiteralPath $root

    $running = @(Get-Process -Name 'Quran Classes Tracker' -ErrorAction SilentlyContinue)
    if ($running.Count -gt 0) {
        Write-Host 'Closing Quran Classes Tracker before building...' -ForegroundColor Cyan
        $running | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }

    $dirty = (& git status --porcelain 2>$null | Out-String).Trim()
    if ([string]::IsNullOrEmpty($dirty)) {
        Write-Host 'Checking for latest commits from GitHub...' -ForegroundColor Cyan
        & git pull --ff-only 2>&1 | Out-Host
    }

    Write-Host 'Installing dependencies...' -ForegroundColor Cyan
    & npm.cmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }

    Write-Host 'Building the application...' -ForegroundColor Cyan
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Application build failed.' }

    & node (Join-Path $root 'build-with-version.cjs') --win --publish never
    if ($LASTEXITCODE -ne 0) { throw 'Installer build failed.' }

    $installer = Get-ChildItem -LiteralPath (Join-Path $root 'dist_electron') -File -Filter '*Setup*.exe' |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $installer) { throw 'Installer was not found in dist_electron.' }

    Write-Host 'Starting the installer...' -ForegroundColor Cyan
    $proc = Start-Process -FilePath $installer.FullName -PassThru -Wait
    if ($proc.ExitCode -ne 0) { throw "Installer exited with code $($proc.ExitCode)." }
    Write-Host 'Installation completed.' -ForegroundColor Green
} catch {
    Write-Host "`n$($_.Exception.Message)" -ForegroundColor Red
    Read-Host 'Press Enter to close' | Out-Null
    exit 1
}
