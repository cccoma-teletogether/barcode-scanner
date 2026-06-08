@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python is not installed or not on PATH.
  pause
  exit /b 1
)
set CGMMGR_PORT=8000
start "CGMMgr" /min python "%~dp0server.py"
echo CGMMgr is starting on http://localhost:8000/cgm-manager.html
echo Close the server window to stop it.
endlocal
