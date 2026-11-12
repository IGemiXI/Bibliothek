@echo off
chcp 65001 >nul
title Bibliothek starten
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js ist nicht installiert.
  echo  Bitte installiere die LTS-Version von https://nodejs.org und starte diese Datei danach erneut.
  echo.
  start https://nodejs.org
  pause
  exit /b 1
)

rem Updates von GitHub holen, wenn per "git clone" installiert
if exist ".git" (
  where git >nul 2>nul
  if not errorlevel 1 (
    echo  Suche nach Updates ...
    git pull --ff-only --quiet
    call npm install --no-audit --no-fund --loglevel=error
  )
)

if not exist "node_modules\electron" (
  echo.
  echo  Erster Start: Die Bibliothek wird eingerichtet ^(dauert ca. 1 Minute^) ...
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo  Die Einrichtung hat nicht geklappt. Bitte Internetverbindung pruefen und erneut starten.
    pause
    exit /b 1
  )
)

start "" "node_modules\electron\dist\electron.exe" .
exit /b 0
