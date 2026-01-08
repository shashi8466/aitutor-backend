@echo off
title Educational Platform - Quick Start
color 0A

echo.
echo ╔════════════════════════════════════════╗
echo ║   Educational Platform Quick Start     ║
echo ╚════════════════════════════════════════╝
echo.

echo 📦 Installing dependencies...
call npm install

echo.
echo 🚀 Starting Backend Server...
echo.
echo    Backend API: http://localhost:3001
echo    Health Check: http://localhost:3001/api/health
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo    Keep this window OPEN!
echo    Press Ctrl+C to stop the server
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

call npm run server

pause