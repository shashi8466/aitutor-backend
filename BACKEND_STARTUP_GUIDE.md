# 🚀 BACKEND STARTUP GUIDE

## ⚠️ CRITICAL: You MUST Start the Backend Server

### The Problem
```
POST http://localhost:3001/api/upload net::ERR_CONNECTION_REFUSED
```

This error means **the backend Express server is NOT running**.

---

## ✅ SOLUTION (Choose One Method)

### **Method 1: Quick Start (Recommended)**

Open your terminal and run:

```bash
npm run dev
```

This starts **both** frontend and backend together.

---

### **Method 2: Manual Start (Two Terminals)**

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run client
```

---

### **Method 3: Backend Only (For Testing)**

```bash
npm run server
```

Then open frontend separately at: http://localhost:5173

---

## ✅ **How to Know Backend Started Successfully**

You **MUST** see these messages in your terminal:

```
🚀 Starting Educational Platform Backend Server...

⚙️ Server Configuration:
 - Port: 3001
 - Environment: development
 - OpenAI Key: ✅ Present

✅ CORS enabled for all origins
✅ Body parsing configured (50MB limit)
✅ Core routes registered

🔗 Loading Feature Routes...

✅ AI Routes mounted at /api/ai
✅ Upload Routes mounted at /api/upload
✅ Payment Routes mounted at /api/payment

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 SERVER SUCCESSFULLY STARTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 Server Address: http://0.0.0.0:3001
🌐 API Base URL: http://localhost:3001/api

📊 Service Status:
 - AI Routes: ✅
 - Upload Routes: ✅
 - Payment Routes: ✅

🔍 Debug Tools:
 - Health Check: http://localhost:3001/api/health
 - Route List: http://localhost:3001/api/debug/routes
 - Upload Test: http://localhost:3001/api/upload/test

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If you DON'T see these messages, the backend didn't start!**

---

## 🧪 **Verify Backend is Working**

Open a **NEW terminal** (keep backend running) and run:

```bash
curl http://localhost:3001/api/health
```

**Expected Response:**
```json
{"status":"ok","message":"Server is active"}
```

**If you get "Connection refused":**
- Backend is NOT running
- Go back and start it again
- Check for error messages in the terminal

---

## 🔧 **Troubleshooting**

### Problem: "Port 3001 is already in use"

**Windows:**
```bash
netstat -ano | findstr :3001
taskkill /PID <PID_NUMBER> /F
```

**Mac/Linux:**
```bash
lsof -i :3001
kill -9 <PID_NUMBER>
```

---

### Problem: "Cannot find module 'express'"

**Fix:**
```bash
npm install
```

---

### Problem: Backend starts but crashes immediately

**Check for errors in the terminal, then:**

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Try again
npm run server
```

---

## 📋 **Startup Checklist**

Before uploading files, verify:

- [ ] Backend terminal shows "SERVER SUCCESSFULLY STARTED"
- [ ] You see "✅ Upload Routes mounted at /api/upload"
- [ ] `curl http://localhost:3001/api/health` returns `{"status":"ok"}`
- [ ] Frontend is accessible at http://localhost:5173
- [ ] No red error messages in backend terminal
- [ ] `.env` file exists with `VITE_BACKEND_URL=http://localhost:3001`

---

## 🎯 **Quick Test Commands**

Run these to verify everything:

```bash
# 1. Check health
curl http://localhost:3001/api/health

# 2. Check routes
curl http://localhost:3001/api/debug/routes

# 3. Test upload endpoint
curl http://localhost:3001/api/upload/test
```

All should return JSON responses without errors.

---

## ⚡ **The Fastest Way**

Just run this and wait 15 seconds:

```bash
npm run dev
```

Then try uploading at: http://localhost:5173

---

## 🆘 **Still Not Working?**

Run the automated diagnostic:

```bash
node check-backend.js
```

This will tell you exactly what's wrong.

---

## 📞 **Common Mistakes**

1. ❌ **Not starting the backend at all** (most common!)
2. ❌ Closing the terminal where backend is running
3. ❌ Starting only frontend but not backend
4. ❌ Wrong port (should be 3001 for backend)
5. ❌ Firewall blocking localhost connections

---

## ✅ **Success Indicators**

You'll know everything is working when:

1. ✅ Backend terminal shows "Server running"
2. ✅ Health check returns `{"status":"ok"}`
3. ✅ Upload completes without errors
4. ✅ No red errors in browser console (F12)
5. ✅ Success message appears in admin panel

---

## 🎉 **Final Command**

```bash
npm run dev
```

**Keep the terminal open and try uploading again!** 🚀