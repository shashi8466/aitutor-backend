#!/bin/bash

echo "🔍 Backend Health Check Script"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo "1️⃣ Checking if backend is running..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running!${NC}"
    
    # Get health status
    echo ""
    echo "📊 Health Status:"
    curl -s http://localhost:3001/api/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3001/api/health
    
    echo ""
    echo ""
    echo "2️⃣ Checking registered routes..."
    curl -s http://localhost:3001/api/debug/routes | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3001/api/debug/routes
    
    echo ""
    echo ""
    echo -e "${GREEN}✅ Backend is fully operational!${NC}"
    echo ""
    echo "You can now:"
    echo "  - Upload files in the admin panel"
    echo "  - Access frontend at http://localhost:5173"
    
else
    echo -e "${RED}❌ Backend is NOT running!${NC}"
    echo ""
    echo "To start the backend, run:"
    echo -e "${YELLOW}npm run server${NC}"
    echo ""
    echo "Or start both frontend and backend:"
    echo -e "${YELLOW}npm run dev${NC}"
    exit 1
fi