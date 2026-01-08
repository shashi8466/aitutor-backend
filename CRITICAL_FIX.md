# 🚨 CRITICAL FIX: Backend Server Not Running

## The Problem
```
POST http://localhost:3001/api/upload net::ERR_CONNECTION_REFUSED
```

This error means **the backend Express server at port 3001 is NOT running**.

---

## ✅ SOLUTION: Start the Backend Server NOW

### **Step 1: Open a Terminal**

Navigate to your project folder:
```bash
cd path/to/your/project
```

---

### **Step 2: Install Dependencies (If Not Done)**

```bash
npm install
```

Wait for it to complete. You should see:
```
added XXX packages
```

---

### **Step 3: Start the Backend Server**

**Option A: Start Backend Only (Recommended for Testing)**
```bash
npm run server
```

**You MUST see these messages:**
```
🚀 Server running on http://0.0.0.0:3001
✅ AI Routes mounted at /api/ai
✅ Upload Routes mounted at /api/upload
```

**If you don't see these messages, the backend didn't start properly.**

---

**Option B: Start Both Frontend and Backend Together**
```bash
npm run dev
```

This will start:
- Backend on port 3001
- Frontend on port 5173

---

### **Step 4: Verify Backend is Running**

Open a **NEW terminal** and run:

```bash
curl http://localhost:3001/api/health
```

**Expected Response:**
```json
{"status":"ok","message":"Server is active","timestamp":"..."}
```

**If you get "Connection refused":**
- The backend is NOT running
- Go back to Step 3
- Check for error messages in the terminal

---

### **Step 5: Check Routes Are Registered**

```bash
curl http://localhost:3001/api/debug/routes
```

**You should see:**
```json
{
  "message": "Registered API Routes",
  "aiRoutesLoaded": true,
  "routes": [
    {"path": "/api/health", "methods": ["get"]},
    {"path": "/api/upload", "methods": ["post"]},
    ...
  ]
}
```

---

### **Step 6: Test Upload Again**

1. Keep the backend terminal running
2. Go to http://localhost:5173
3. Login as admin
4. Try uploading a file again
5. ✅ **It should work now!**

---

## 🔍 **Troubleshooting**

### Problem: "Port 3001 is already in use"

**Find what's using the port:**

**Windows:**
```bash
netstat -ano | findstr :3001
```

**Mac/Linux:**
```bash
lsof -i :3001
```

**Kill the process or change the port in `.env`:**
```
PORT=3002
```

Then update `App.jsx`:
```javascript
const BACKEND_URL = 'http://localhost:3002';
```

---

### Problem: Backend starts but crashes immediately

**Check for these common issues:**

1. **Missing Environment Variables**
   - Ensure `.env` file exists in the root directory
   - Verify it contains `OPENAI_API_KEY` or `VITE_OPENAI_API_KEY`

2. **Missing Dependencies**
   ```bash
   npm install express cors multer dotenv openai @google/generative-ai adm-zip pdf-parse xmldom
   ```

3. **Syntax Errors**
   - Check the backend terminal for error messages
   - Look for lines starting with `Error:` or `SyntaxError:`

---

### Problem: "Cannot find module" errors

**Reinstall dependencies:**
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 📊 **How to Know Everything is Working**

### ✅ Backend Terminal Should Show:
```
🔧 Initializing AI Utils...
✅ AI Utils module loaded
🔧 Initializing Payment Routes...
✅ Payment Routes mounted at /api/payment
🤖 Initializing AI Routes...
✅ AI Routes module loaded successfully

🚀 Server running on http://0.0.0.0:3001
🤖 AI Provider: OpenAI (or Google Gemini)
📡 API Base: http://localhost:3001/api
🔍 Debug Routes: http://localhost:3001/api/debug/routes
```

### ✅ Browser Console Should Show:
```
📡 API Request: POST /api/upload
✅ API Response: POST /api/upload - 200
```

### ✅ Upload Should Complete Successfully
You'll see a success message in the admin panel.

---

## 🎯 **Quick Commands Reference**

| Command | Purpose |
|---------|---------|
| `npm run server` | Start backend only |
| `npm run client` | Start frontend only |
| `npm run dev` | Start both together |
| `npm install` | Install dependencies |
| `curl http://localhost:3001/api/health` | Test backend |
| `curl http://localhost:3001/api/debug/routes` | List all routes |

---

## 🆘 **Still Not Working?**

### Run Full Diagnostic:

```bash
# 1. Check Node version
node --version

# 2. Check npm version
npm --version

# 3. Check if backend files exist
ls src/server/index.js

# 4. Try starting with verbose logging
NODE_ENV=development npm run server

# 5. Check for firewall issues
curl -v http://localhost:3001/api/health
```

---

## 💡 **Understanding the Architecture**

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Frontend   │         │   Backend   │         │  Supabase   │
│  (React)    │────────▶│  (Express)  │────────▶│  (Database) │
│  Port 5173  │  HTTP   │  Port 3001  │   SQL   │             │
└─────────────┘         └─────────────┘         └─────────────┘
```

**Your error occurs at the first arrow** - the frontend can't reach the backend because it's not running.

---

## 🎯 **Final Checklist**

Before trying to upload again:

- [ ] Backend terminal is open and showing "Server running on http://0.0.0.0:3001"
- [ ] Frontend is accessible at http://localhost:5173
- [ ] `curl http://localhost:3001/api/health` returns `{"status":"ok"}`
- [ ] No error messages in backend terminal
- [ ] `.env` file exists with valid API keys

---

## ⚡ **The Fastest Fix**

If you just want it to work RIGHT NOW:

1. **Open Terminal**
2. **Run:** `npm run dev`
3. **Wait 10 seconds** for both servers to start
4. **Go to:** http://localhost:5173
5. **Login and try upload**

That's it! 🎉