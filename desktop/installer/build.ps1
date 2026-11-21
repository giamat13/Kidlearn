# Builds desktop\dist\KidlearnSetup.exe
#   1. downloads the .NET 10 Desktop Runtime installer once (installer\prereq, git-ignored)
#   2. publishes the tray app (desktop\dist\app\Kidlearn.exe)
#   3. compiles the Inno Setup script
# Requirements: .NET 10 SDK (winget install Microsoft.DotNet.SDK.10)
#               Inno Setup 6 (winget install JRSoftware.InnoSetup)

$ErrorActionPreference = 'Stop'

$desktop = Split-Path -Parent $PSScriptRoot
$prereqDir = Join-Path $PSScriptRoot 'prereq'
$runtimeInstaller = Join-Path $prereqDir 'windowsdesktop-runtime-win-x64.exe'
$ytDlpInstaller = Join-Path $prereqDir 'yt-dlp.exe'
$ytDlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
$runtimeUrl = 'https://aka.ms/dotnet/10.0/windowsdesktop-runtime-win-x64.exe'

$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnet) {
    throw 'dotnet SDK not found. Install it with: winget install Microsoft.DotNet.SDK.10'
}

$iscc = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'),
    (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) {
    throw 'Inno Setup 6 not found. Install it with: winget install JRSoftware.InnoSetup'
}

if (-not (Test-Path $runtimeInstaller)) {
    New-Item -ItemType Directory -Force $prereqDir | Out-Null
    Write-Host "Downloading .NET Desktop Runtime installer..."
    Invoke-WebRequest -Uri $runtimeUrl -OutFile $runtimeInstaller -UseBasicParsing
}

if (-not (Test-Path $ytDlpInstaller)) {
    New-Item -ItemType Directory -Force $prereqDir | Out-Null
    Write-Host "Downloading yt-dlp from the official project release..."
    Invoke-WebRequest -Uri $ytDlpUrl -OutFile $ytDlpInstaller -UseBasicParsing
}
if ((Get-Item $ytDlpInstaller).Length -lt 1MB) {
    throw 'yt-dlp.exe download looks invalid. Delete desktop\installer\prereq\yt-dlp.exe and retry.'
}

Write-Host "Publishing tray app..."
& $dotnet.Source publish (Join-Path $desktop 'app\Kidlearn.csproj') -c Release -o (Join-Path $desktop 'dist\app')
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed ($LASTEXITCODE)" }

# The native host goes into the same folder, so the installer ships both together
Write-Host "Publishing native messaging host..."
& $dotnet.Source publish (Join-Path $desktop 'host\KidlearnHost.csproj') -c Release -o (Join-Path $desktop 'dist\app')
if ($LASTEXITCODE -ne 0) { throw "dotnet publish (host) failed ($LASTEXITCODE)" }

Copy-Item -Force $ytDlpInstaller (Join-Path $desktop 'dist\app\yt-dlp.exe')

Write-Host "Compiling installer..."
& $iscc (Join-Path $PSScriptRoot 'Kidlearn.iss')
if ($LASTEXITCODE -ne 0) { throw "ISCC failed ($LASTEXITCODE)" }

Write-Host "Built: $(Join-Path $desktop 'dist\KidlearnSetup.exe')"
