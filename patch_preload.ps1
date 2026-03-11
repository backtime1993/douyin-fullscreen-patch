# Douyin True Fullscreen Patcher
# Injects fullscreen payload into preload.js and keeps a version-specific backup
# Must run elevated (Administrator)

param(
    [string]$DouyinRoot = "C:\Program Files (x86)\ByteDance\douyin",
    [string]$BackupPath,
    [string]$PayloadPath = (Join-Path $PSScriptRoot "fullscreen_payload.js"),
    [string]$BackupRoot = "C:\temp\douyin_patch_work",
    [string]$ResultPath = "C:\temp\douyin_patch\patch_result.txt"
)

$ErrorActionPreference = "Stop"
$Marker = "// ═══ DOUYIN TRUE FULLSCREEN PATCH V2 ═══"

function Ensure-ParentDirectory {
    param([string]$Path)

    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
}

function Get-LatestDouyinVersionFolder {
    param([string]$Root)

    $versions = Get-ChildItem -Path $Root -Directory |
        Where-Object { $_.Name -match '^\d+\.\d+\.\d+' } |
        Sort-Object Name -Descending

    if ($versions.Count -eq 0) {
        throw "Could not find any Douyin version folder under $Root"
    }

    return $versions[0]
}

function Resolve-BackupPath {
    param(
        [string]$PreferredPath,
        [string]$Version,
        [string]$Root
    )

    if ($PreferredPath) {
        if (-not (Test-Path $PreferredPath)) {
            throw "Backup not found: $PreferredPath"
        }
        return (Resolve-Path $PreferredPath).Path
    }

    return (Join-Path $Root ("preload_original_{0}.js" -f $Version))
}

try {
    $latestVersion = Get-LatestDouyinVersionFolder -Root $DouyinRoot
    $preloadPath = Join-Path $latestVersion.FullName "resources\app.asar.unpacked\preload.js"
    $resolvedBackupPath = Resolve-BackupPath -PreferredPath $BackupPath -Version $latestVersion.Name -Root $BackupRoot

    if (-not (Test-Path $preloadPath)) {
        throw "preload.js not found: $preloadPath"
    }
    if (-not (Test-Path $PayloadPath)) {
        throw "Payload not found: $PayloadPath"
    }

    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    $currentContent = [System.IO.File]::ReadAllText($preloadPath, [System.Text.Encoding]::UTF8)
    $targetAlreadyPatched = $currentContent.Contains($Marker)

    Write-Host "Target version: $($latestVersion.Name)"
    Write-Host "Target preload.js: $preloadPath"

    if (Test-Path $resolvedBackupPath) {
        $originalContent = [System.IO.File]::ReadAllText($resolvedBackupPath, [System.Text.Encoding]::UTF8)
        if ($originalContent.Contains($Marker)) {
            throw "Backup is already patched: $resolvedBackupPath"
        }
        Write-Host "Using backup: $resolvedBackupPath"
        Write-Host "Original preload.js: $($originalContent.Length) bytes"
    }
    elseif ($targetAlreadyPatched) {
        throw "Original backup missing for version $($latestVersion.Name). Pass -BackupPath explicitly."
    }
    else {
        Ensure-ParentDirectory -Path $resolvedBackupPath
        $originalContent = $currentContent
        [System.IO.File]::WriteAllText($resolvedBackupPath, $originalContent, $utf8NoBom)
        Write-Host "Created version-specific backup: $resolvedBackupPath"
        Write-Host "Original preload.js: $($originalContent.Length) bytes"
    }

    $payloadContent = [System.IO.File]::ReadAllText($PayloadPath, [System.Text.Encoding]::UTF8)
    Write-Host "Payload: $($payloadContent.Length) bytes"

    $newContent = $originalContent + "`r`n`r`n" + $Marker + "`r`n" + $payloadContent

    [System.IO.File]::WriteAllText($preloadPath, $newContent, $utf8NoBom)
    $finalSize = (Get-Item $preloadPath).Length
    Write-Host "Patched preload.js: $finalSize bytes"

    Ensure-ParentDirectory -Path $ResultPath
    "OK|$finalSize|$preloadPath" | Out-File -FilePath $ResultPath -Encoding utf8 -NoNewline
    Write-Host "Patch successful!"
}
catch {
    $errMsg = "ERROR|$($_.Exception.Message)"
    Ensure-ParentDirectory -Path $ResultPath
    $errMsg | Out-File -FilePath $ResultPath -Encoding utf8 -NoNewline
    Write-Host "Patch failed: $($_.Exception.Message)"
    exit 1
}
