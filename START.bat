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

rem Updates von GitHub holen. Danach startet sich diese Datei frisch neu,
rem weil git sie beim Update ueberschrieben haben kann.
if not "%~1"=="--weiter" if exist ".git" (
  where git >nul 2>nul
  if not errorlevel 1 (
    echo  Suche nach Updates ...
    git pull --ff-only --quiet
    "%~f0" --weiter
  )
)

if not exist "node_modules\electron\package.json" (
  echo.
  echo  Die Bibliothek wird eingerichtet ^(dauert ca. 1 Minute^) ...
  echo.
)
call npm install --no-audit --no-fund --loglevel=error

rem Electron laedt sein eigentliches Programm in einem eigenen Schritt nach.
rem Falls npm diesen Schritt uebersprungen hat, hier selbst ausfuehren.
if not exist "node_modules\electron\dist\electron.exe" (
  echo  Lade Electron herunter ...
  call node "node_modules\electron\install.js"
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo.
  echo  Electron konnte nicht geladen werden.
  echo  Bitte Internetverbindung pruefen und START.bat erneut starten.
  echo  Wenn es weiter nicht klappt: den Ordner node_modules loeschen und neu versuchen.
  echo.
  pause
  exit /b 1
)

start "" "node_modules\electron\dist\electron.exe" .
exit /b 0
