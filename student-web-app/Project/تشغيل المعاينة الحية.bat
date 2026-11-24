@echo off
chcp 65001 >nul
title بوابة الطالب - معاينة حية
cd /d "%~dp0"

echo ===================================================
echo        Student Web Portal - Live Preview
echo ===================================================
echo.

netstat -ano | findstr ":5174 " >nul
if errorlevel 1 goto start_server

echo [OK] Local preview server is already running.
goto open_browser

:start_server
echo [*] Starting local preview server...
start "" /b node tools\dev-server.mjs
ping 127.0.0.1 -n 2 >nul

:open_browser
echo [*] Opening a live student profile in browser...
start http://localhost:5174/

echo.
echo [OK] Ready! Edits to Project\index.html will auto-refresh the page.
ping 127.0.0.1 -n 3 >nul
