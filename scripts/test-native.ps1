$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$testRoot = Join-Path $projectRoot '.cache\native-selection'
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
$testExecutable = Join-Path $testRoot 'DesktopSelectionTests.exe'
& $compiler /nologo /codepage:65001 /target:exe /platform:x64 "/out:$testExecutable" /r:Microsoft.CSharp.dll "$projectRoot\native\DesktopSelection.cs" "$projectRoot\tests\native\DesktopSelectionTests.cs"
if ($LASTEXITCODE -ne 0) { throw 'Native selection test compilation failed.' }
$testFixtures = Join-Path $testRoot ([Guid]::NewGuid().ToString())
& $testExecutable $testFixtures
if ($LASTEXITCODE -ne 0) { throw 'Native selection regression failed.' }
