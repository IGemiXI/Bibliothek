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
    if errorlevel 1 (
      rem Lokale Aenderungen (z. B. Zeilenenden) blockieren das Update: Programmdateien auf den Stand von GitHub bringen.
      rem Deine Einstellungen liegen in %%APPDATA%%\Bibliothek und sind davon nicht betroffen.
      echo  Update wird erzwungen ...
      git fetch --quiet origin
      git reset --quiet --hard origin/main
    )
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
  echo  Lade Electron herunter ^(ca. 100 MB, kann etwas dauern^) ...
  set ELECTRON_SKIP_BINARY_DOWNLOAD=
  if exist "node_modules\electron\path.txt" del /q "node_modules\electron\path.txt"
  rem Kaputten Zwischenspeicher eines abgebrochenen Downloads entfernen
  if exist "%LOCALAPPDATA%\electron\Cache" rmdir /s /q "%LOCALAPPDATA%\electron\Cache"
  call node "node_modules\electron\install.js"
)

if not exist "node_modules\electron\dist\electron.exe" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "tools\get-electron.ps1"
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo.
  echo  ---- Diagnose ----
  echo  Inhalt von node_modules\electron\dist:
  dir /b "node_modules\electron\dist" 2>nul
  echo  ------------------
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
