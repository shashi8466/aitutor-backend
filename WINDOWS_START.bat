@echo off
title Educational Platform Server
color 0A

echo.
echo ========================================
echo   Educational Platform Backend
echo ========================================
echo.
echo [Step 1/3] Installing dependencies...
call npm install

echo.
echo [Step 2/3] Starting Backend Server...
echo.
echo   Backend API: http://localhost:3001
echo   Health Check: http://localhost:3001/api/health
echo.
echo ========================================
echo   Server is starting...
echo   Keep this window OPEN!
echo ========================================
echo.

call npm run server

pause