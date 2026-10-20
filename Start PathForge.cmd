@echo off
setlocal
cd /d "%~dp0"
title Veyra Backend
echo Starting Veyra...
echo.
node src\server.js
echo.
echo Veyra stopped. Press any key to close this window.
pause >nul
