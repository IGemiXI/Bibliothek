# Lädt Electron direkt von GitHub herunter, falls der normale npm-Weg nicht klappt.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # macht den Download in PowerShell 5 deutlich schneller
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot
$eDir = Join-Path $root 'node_modules\electron'
$v = (Get-Content (Join-Path $eDir 'package.json') -Raw | ConvertFrom-Json).version
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$url = "https://github.com/electron/electron/releases/download/v$v/electron-v$v-win32-$arch.zip"
$zip = Join-Path $env:TEMP "electron-v$v-win32-$arch.zip"
$dist = Join-Path $eDir 'dist'

Write-Host " Lade Electron $v direkt von GitHub (ca. 100 MB) ..."
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
Write-Host ' Entpacke ...'
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $dist -Force
Set-Content -Path (Join-Path $eDir 'path.txt') -Value 'electron.exe' -NoNewline
Remove-Item $zip -Force -ErrorAction SilentlyContinue

if (Test-Path (Join-Path $dist 'electron.exe')) {
  Write-Host ' Electron ist bereit.'
  exit 0
}
Write-Host ' electron.exe fehlt nach dem Entpacken - vermutlich hat der Virenschutz die Datei entfernt.'
Write-Host ' Bitte unter Windows-Sicherheit > Viren- & Bedrohungsschutz > Schutzverlauf nachsehen.'
exit 1
