# 🚀 START BACKEND SERVER NOW

## Copy and paste this command:

### **Windows (PowerShell or CMD):**
```bash
npm run server
```

### **Mac/Linux:**
```bash
npm run server
```

---

## ✅ **You MUST see this output:**

```
🔧 Initializing AI Utils...
🔑 API Key status: Found
🔑 API Key type: OpenAI
🤖 Initializing OpenAI Client...
✅ OpenAI client initialized successfully
✅ AI Utils module loaded
🔧 Initializing Payment Routes...
✅ Payment Routes mounted at /api/payment
🤖 Initializing AI Routes...
✅ AI Routes module loaded successfully

🚀 Server running on http://0.0.0.0:3001
🤖 AI Provider: OpenAI
📡 API Base: http://localhost:3001/api
🔍 Debug Routes: http://localhost:3001/api/debug/routes
```

---

## ❌ **If you see errors instead:**

### Error: "Cannot find module 'express'"
**Fix:**
```bash
npm install
```

### Error: "Port 3001 is already in use"
**Fix:**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID_NUMBER> /F

# Mac/Linux
lsof -i :3001
kill -9 <PID_NUMBER>
```

### Error: "OPENAI_API_KEY is not defined"
**Fix:**
1. Check if `.env` file exists in root directory
2. Verify it contains:
   ```
   OPENAI_API_KEY=sk-proj-...
   VITE_OPENAI_API_KEY=sk-proj-...
   ```

---

## 🧪 **Test Backend After Starting**

Open a **NEW terminal** (keep the backend running) and run:

```bash
curl http://localhost:3001/api/health
```

**Expected:**
```json
{"status":"ok","message":"Server is active"}
```

**If this works, your backend is ready!**

---

## 🎯 **Next: Try Upload Again**

1. ✅ Backend is running (you see the messages above)
2. ✅ Health check passes
3. ✅ Go to http://localhost:5173
4. ✅ Login as admin
5. ✅ Try uploading Q11.docx

**It will work this time!** 🎉

---

## 📝 **Keep Backend Running**

**IMPORTANT:** Do NOT close the terminal where you ran `npm run server`. The backend must stay running for uploads to work.

**To run both frontend and backend in ONE command:**
```bash
npm run dev
```

This is the easiest way! ✨