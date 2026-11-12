$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
& node scripts/tauri.cjs build --debug --no-bundle --features smoke-test
if ($LASTEXITCODE -ne 0) { throw 'Tauri smoke build failed.' }
$testRoot = Join-Path $projectRoot ('.cache\runtime-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
$previousData = $env:WARP_DATA_DIR
$previousReport = $env:WARP_SMOKE_REPORT
try {
  $env:WARP_DATA_DIR = Join-Path $testRoot 'profile'
  $env:WARP_SMOKE_REPORT = Join-Path $testRoot 'report.json'
  $process = Start-Process -FilePath (Join-Path $projectRoot 'src-tauri\target\debug\warp.exe') -WindowStyle Hidden -PassThru
  if (!$process.WaitForExit(90000)) { Stop-Process -Id $process.Id; throw 'Tauri smoke test timed out.' }
  $report = Get-Content -LiteralPath $env:WARP_SMOKE_REPORT -Raw | ConvertFrom-Json
  if ($process.ExitCode -ne 0 -or !$report.ok) { throw ('Tauri smoke failed: ' + ($report | ConvertTo-Json -Depth 8)) }
  $report | ConvertTo-Json -Depth 8
} finally {
  $env:WARP_DATA_DIR = $previousData
  $env:WARP_SMOKE_REPORT = $previousReport
}
