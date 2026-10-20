@echo off
setlocal
cd /d "%~dp0"
title Veyra Tests
echo Running Veyra checks...
echo.
call npm.cmd test
if errorlevel 1 goto failed
call npm.cmd run check
if errorlevel 1 goto failed
echo.
echo All Veyra checks passed.
pause
exit /b 0
:failed
echo.
echo A Veyra check failed. Leave this window open and share it with Codex.
pause
exit /b 1
