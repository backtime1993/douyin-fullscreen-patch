param(
    [string]$DouyinRoot = "C:\Program Files (x86)\ByteDance\douyin",
    [string]$PayloadPath = (Join-Path $PSScriptRoot "fullscreen_payload.js")
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$Marker = "// ═══ DOUYIN TRUE FULLSCREEN PATCH V2 ═══"

$versions = Get-ChildItem -Path $DouyinRoot -Directory |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+' } |
    Sort-Object Name -Descending

if ($versions.Count -eq 0) {
    throw "Could not find any Douyin version folder under $DouyinRoot"
}

$target = Join-Path $versions[0].FullName "resources\app.asar.unpacked\preload.js"
if (-not (Test-Path $target)) {
    throw "Target preload.js not found: $target"
}

if (-not (Test-Path $PayloadPath)) {
    throw "Payload not found: $PayloadPath"
}

$current = Get-Content -Path $target -Raw -Encoding UTF8
$markerIndex = $current.IndexOf($Marker)
if ($markerIndex -lt 0) {
    throw "Patch marker not found in $target"
}

$backupPath = "$target.bak.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -Path $target -Destination $backupPath -Force

$prefix = $current.Substring(0, $markerIndex)
$payload = Get-Content -Path $PayloadPath -Raw -Encoding UTF8
$newContent = $prefix + $Marker + "`r`n" + $payload

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($target, $newContent, $utf8NoBom)

Write-Host "Patched preload.js successfully." -ForegroundColor Green
Write-Host "Target : $target"
Write-Host "Backup : $backupPath"
Write-Host "Restart Douyin to load the updated fullscreen payload."
