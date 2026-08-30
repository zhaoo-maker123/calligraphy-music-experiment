@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python or run another local HTTP server for the site folder.
  pause
  exit /b 1
)

start "Calligraphy Experiment - close this window to stop" cmd /k python scripts\serve.py
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8080/"

endlocal
