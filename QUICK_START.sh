#!/bin/bash

# Quick Start Script for Mac/Linux
# Makes it super easy to start the backend

clear

echo "╔════════════════════════════════════════╗"
echo "║   Educational Platform Quick Start     ║"
echo "╔════════════════════════════════════════╗"
echo ""

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🚀 Starting Backend Server..."
echo ""
echo "   Backend API: http://localhost:3001"
echo "   Health Check: http://localhost:3001/api/health"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Keep this terminal OPEN!"
echo "   Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run server