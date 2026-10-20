@echo off
setlocal
cd /d "%~dp0"
title PathForge Backend
echo Starting PathForge...
echo.
node src\server.js
echo.
echo PathForge stopped. Press any key to close this window.
pause >nul
