@echo off
echo 🔍 Backend Health Check Script
echo ================================
echo.

echo 1️⃣ Checking if backend is running...
curl -s http://localhost:3001/api/health >nul 2>&1

if %errorlevel% equ 0 (
    echo ✅ Backend is running!
    echo.
    echo 📊 Health Status:
    curl -s http://localhost:3001/api/health
    echo.
    echo.
    echo 2️⃣ Checking registered routes...
    curl -s http://localhost:3001/api/debug/routes
    echo.
    echo.
    echo ✅ Backend is fully operational!
    echo.
    echo You can now:
    echo   - Upload files in the admin panel
    echo   - Access frontend at http://localhost:5173
) else (
    echo ❌ Backend is NOT running!
    echo.
    echo To start the backend, run:
    echo   npm run server
    echo.
    echo Or start both frontend and backend:
    echo   npm run dev
    exit /b 1
)