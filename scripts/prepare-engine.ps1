$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path $PSScriptRoot -Parent
$vendor = Join-Path $projectRoot 'vendor'
$runtime = Join-Path $vendor 'libreoffice'
$manifest = Join-Path $runtime 'warp-engine.json'
$version = '26.8.2'
$sha256 = 'ff4b911403b67ee9e6249f820f9782c44bb32c94fdaa45b0da53a8e419e5307a'
function Complete-AppLocalRuntime {
    # MSI normally installs these into System32. Keep the supplied x64 DLLs app-local
    # instead, so Warp does not depend on a separate Visual C++ runtime install.
    $system64 = Join-Path $runtime 'System64'
    if (Test-Path $system64) {
        Get-ChildItem -LiteralPath $system64 -Filter '*.dll' -File | ForEach-Object {
            $destination = Join-Path $runtime ('program\' + $_.Name)
            if (!(Test-Path $destination)) { Copy-Item -LiteralPath $_.FullName -Destination $destination }
        }
    }
}
if ((Test-Path $manifest) -and (Test-Path (Join-Path $runtime 'program\soffice.com'))) {
    $existing = Get-Content $manifest -Raw | ConvertFrom-Json
    if ($existing.version -eq $version -and $existing.sha256 -eq $sha256) { Complete-AppLocalRuntime; Write-Host 'Bundled conversion engine ready.'; exit 0 }
    throw 'Existing engine differs from the pinned version. Use a clean vendor directory.'
}
$cache = Join-Path $projectRoot '.cache\engine'
New-Item -ItemType Directory -Force $cache,$vendor | Out-Null
$msi = Join-Path $cache "LibreOffice_${version}_Win_x86-64.msi"
$url = "https://download.documentfoundation.org/libreoffice/stable/$version/win/x86_64/LibreOffice_${version}_Win_x86-64.msi"
if (!(Test-Path $msi)) {
    Write-Host "Downloading pinned LibreOffice $version for bundling..."
    # Resume interrupted downloads; source contents are verified below before execution.
    & curl.exe --location --fail --silent --show-error --retry 3 --retry-delay 2 --continue-at - --max-time 1800 --output "$msi.download" $url
    if ($LASTEXITCODE -ne 0) { throw 'Engine download interrupted; rerun prepare:engine to resume.' }
    Move-Item -LiteralPath "$msi.download" -Destination $msi -Force
}
if ((Get-FileHash $msi -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sha256) { throw 'Engine download checksum mismatch.' }
$image = Join-Path $cache 'image'
New-Item -ItemType Directory -Force $image | Out-Null
# Administrative extraction only: does not install LibreOffice or change file associations.
$arguments = @('/a', ('"' + $msi + '"'), '/qn', '/norestart', ('TARGETDIR="' + $image + '"'), '/L*v', ('"' + (Join-Path $cache 'extract.log') + '"'))
$process = Start-Process -FilePath (Join-Path $env:WINDIR 'System32\msiexec.exe') -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait
if ($process.ExitCode -ne 0) { throw "Engine extraction failed ($($process.ExitCode)); see .cache/engine/extract.log" }
$soffice = Get-ChildItem -LiteralPath $image -Recurse -Filter soffice.com | Select-Object -First 1
if (!$soffice) { throw 'Extracted engine is incomplete: soffice.com is missing.' }
$engineRoot = Split-Path (Split-Path $soffice.FullName -Parent) -Parent
if (Test-Path $runtime) { throw 'Incomplete vendor runtime exists. Review it before replacing.' }
New-Item -ItemType Directory -Force $runtime | Out-Null
Get-ChildItem -LiteralPath $engineRoot | Where-Object { $_.Extension -ne '.msi' } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $runtime -Recurse }
Complete-AppLocalRuntime
@{version=$version; sha256=$sha256; url=$url; source='https://download.documentfoundation.org/libreoffice/src/26.8.2/'; modified=$false} | ConvertTo-Json | Set-Content -LiteralPath $manifest -Encoding utf8
Write-Host 'Bundled conversion engine prepared without installing it into Windows.'
