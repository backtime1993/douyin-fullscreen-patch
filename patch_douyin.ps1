# Douyin Desktop UI Customization Patcher
# Purpose: Inject custom fullscreen logic into Douyin's app.asar

param(
    [string]$DouyinRoot = "C:\Program Files (x86)\ByteDance\douyin",
    [string]$TempDir = "C:\temp\douyin_patch_work",
    [string]$PayloadPath = (Join-Path $PSScriptRoot "fullscreen_payload.js")
)

$ErrorActionPreference = "Stop"
$Marker = "// ═══ DOUYIN TRUE FULLSCREEN PATCH V2 ═══"

function Assert-LastExitCode {
    param([string]$Step)

    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE"
    }
}

Write-Host "--- Douyin UI Patcher ---" -ForegroundColor Cyan

$versions = Get-ChildItem -Path $DouyinRoot -Directory |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+' } |
    Sort-Object Name -Descending

if ($versions.Count -eq 0) {
    Write-Error "Could not find Douyin version folder in $DouyinRoot"
    exit
}

$latestVersion = $versions[0]
$asarPath = Join-Path $latestVersion.FullName "resources\app.asar"
Write-Host "Targeting version: $($latestVersion.Name)"
Write-Host "ASAR Path: $asarPath"

if (-not (Test-Path $asarPath)) {
    Write-Error "app.asar not found at $asarPath"
    exit
}
if (-not (Test-Path $PayloadPath)) {
    Write-Error "Payload not found: $PayloadPath"
    exit
}

if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
$extractedDir = Join-Path $TempDir "extracted"

Write-Host "Extracting app.asar... (This may take a moment)"
npx -y asar extract $asarPath $extractedDir
Assert-LastExitCode "asar extract"

$preloadPath = Join-Path $extractedDir "preload.js"
if (-not (Test-Path $preloadPath)) {
    Write-Error "preload.js not found in extracted archive"
    exit
}

Write-Host "Injecting payload into preload.js..."
$payloadContent = Get-Content -Path $PayloadPath -Raw -Encoding UTF8
$currentPreload = Get-Content -Path $preloadPath -Raw -Encoding UTF8
$markerIndex = $currentPreload.IndexOf($Marker)

if ($markerIndex -ge 0) {
    Write-Host "Existing payload marker found. Replacing payload in-place..."
    $prefix = $currentPreload.Substring(0, $markerIndex)
    $newPreload = $prefix + $Marker + "`r`n" + $payloadContent
} else {
    Write-Host "No existing payload marker found. Appending payload..."
    $newPreload = $currentPreload + "`r`n`r`n" + $Marker + "`r`n" + $payloadContent
}

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($preloadPath, $newPreload, $utf8NoBom)

$newAsarPath = Join-Path $TempDir "app_patched.asar"
Write-Host "Repacking app.asar..."
npx -y asar pack $extractedDir $newAsarPath
Assert-LastExitCode "asar pack"

if (-not (Test-Path $newAsarPath)) {
    throw "Repacked ASAR not found: $newAsarPath"
}

Write-Host "`nPatch successful!" -ForegroundColor Green
Write-Host "1. Backup the original: $asarPath"
Write-Host "2. Replace it with: $newAsarPath"
Write-Host "3. Restart Douyin."

Write-Host "`nNote: If Douyin is running, please close it first."
