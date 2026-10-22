@echo off
setlocal
cd /d "%~dp0"
set "NODE_OPTIONS=--require ./.fix_hostname.cjs"
set "COMPUTERNAME=OmarSharif"
set "USERDOMAIN=OmarSharif"
title Vercel Production Deployment - Student Web App
cls
color 0B

echo ================================================================
echo    ▲ VERCEL PRODUCTION DEPLOYMENT - STUDENT WEB APP
echo    Quran Classes Tracker - Student Web Portal
echo ================================================================
echo.
echo [*] Working Directory: %CD%
echo [*] Deploying updates to Vercel (Production)...
echo.

call vercel --prod --yes

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================
    echo    [SUCCESS] Deployment to Vercel completed successfully!
    echo.
    echo    Live URL: https://project-mw5jh.vercel.app
    echo ================================================================
) else (
    echo.
    echo ================================================================
    echo    [ERROR] Deployment failed! Please check the output above.
    echo ================================================================
)

echo.
echo Press any key to exit...
pause >nul
endlocal
