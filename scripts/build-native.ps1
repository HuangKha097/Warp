$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\WPF'
& $compiler /nologo /codepage:65001 /target:exe /platform:x64 "/out:$projectRoot\native\SelectionWatcher.exe" /r:Microsoft.CSharp.dll "/r:$framework\UIAutomationClient.dll" "/r:$framework\UIAutomationTypes.dll" "/r:$framework\WindowsBase.dll" "$projectRoot\native\SelectionWatcher.cs" "$projectRoot\native\DesktopSelection.cs"
if ($LASTEXITCODE -ne 0) { throw 'Native helper compilation failed.' }
