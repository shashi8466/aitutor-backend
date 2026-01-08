<<<<<<< HEAD
# aitutor-backend
aitutor-backend
=======
# Educational Platform

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Backend server running on port 3001
- Frontend dev server running on port 5173

### Starting the Application

**Windows:**
```bash
start-dev.bat
```

**Mac/Linux:**
```bash
chmod +x start-dev.sh
./start-dev.sh
```

**Manual Start:**
```bash
# Install dependencies
npm install

# Start both frontend and backend
npm run dev
```

## Important URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **API Debug**: http://localhost:3001/api/debug/routes
- **Health Check**: http://localhost:3001/api/health

## Troubleshooting

### 404 API Errors

If you see errors like "POST http://localhost:3001/api/ai/generate-similar 404":

1. **Verify backend is running**:
   ```bash
   curl http://localhost:3001/api/health
   ```

2. **Check registered routes**:
   ```bash
   curl http://localhost:3001/api/debug/routes
   ```

3. **Restart the backend server**:
   - Stop the current process (Ctrl+C)
   - Run `npm run dev` again

4. **Check environment variables**:
   - Ensure `.env` file exists in the root directory
   - Verify `VITE_BACKEND_URL=http://localhost:3001` is set

### Common Issues

**"Cannot connect to backend"**
- Ensure both frontend (5173) and backend (3001) are running
- Check if another process is using port 3001
- Verify firewall isn't blocking localhost connections

**"API endpoint not found"**
- Check backend console logs for route registration messages
- Visit http://localhost:3001/api/debug/routes to see all routes
- Ensure the backend started without errors

**"AI service not responding"**
- Verify `OPENAI_API_KEY` is set in `.env`
- Check backend logs for AI initialization messages
- Test API key with: `node test-openai.js`

## Architecture

```
Frontend (React) → Axios → Backend (Express) → AI Services
     ↓                                ↓
  Supabase ←──────────────────────────┘
```

## Support

For issues, check:
1. Browser console (F12) for frontend errors
2. Terminal/command prompt for backend logs
3. Network tab (F12) to see actual API requests
>>>>>>> 91a53b0 (Initial commit with AI optimizations and UI fixes)
