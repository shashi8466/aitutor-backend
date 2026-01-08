#!/bin/bash

# Make the script executable: chmod +x MAC_START.sh
# Run with: ./MAC_START.sh

clear

echo "========================================"
echo "  Educational Platform Backend"
echo "========================================"
echo ""
echo "[Step 1/3] Installing dependencies..."
npm install

echo ""
echo "[Step 2/3] Starting Backend Server..."
echo ""
echo "  Backend API: http://localhost:3001"
echo "  Health Check: http://localhost:3001/api/health"
echo ""
echo "========================================"
echo "  Server is starting..."
echo "  Keep this terminal OPEN!"
echo "========================================"
echo ""

npm run server