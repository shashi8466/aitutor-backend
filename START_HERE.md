# 🚨 CRITICAL: Backend Server Not Running

## Error Diagnosis
```
POST http://localhost:3001/api/upload net::ERR_CONNECTION_REFUSED
```

This means the **backend Express server is not running**.

---

## ✅ **Solution: Start Both Servers**

### **Option 1: Automatic Start (Recommended)**

**Windows:**
```bash
start-dev.bat
```

**Mac/Linux:**
```bash
chmod +x start-dev.sh
./start-dev.sh
```

---

### **Option 2: Manual Start**

Open **TWO separate terminals**:

**Terminal 1 (Backend):**
```bash
npm run server
```

Wait for:
```
🚀 Server running on http://0.0.0.0:3001
✅ AI Routes mounted at /api/ai
```

**Terminal 2 (Frontend):**
```bash
npm run client
```

---

### **Option 3: Combined Start**
```bash
npm run dev
```

This runs both servers simultaneously using `concurrently`.

---

## 🔍 **Verification Steps**

Once servers are running, verify:

**1. Backend Health Check:**
```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{"status":"ok","message":"Server is active"}
```

**2. Check Registered Routes:**
```bash
curl http://localhost:3001/api/debug/routes
```

**3. Frontend Access:**
- Open browser: http://localhost:5173
- Try uploading a file again

---

## 🛠️ **If Backend Still Won't Start**

### Check Port Availability
```bash
# Windows
netstat -ano | findstr :3001

# Mac/Linux
lsof -i :3001
```

If port is occupied, kill the process or change the port in `.env`:
```
PORT=3002
```

### Check Dependencies
```bash
npm install
```

### Check for Errors
Look for these messages when starting backend:
```
✅ Server running on http://0.0.0.0:3001
✅ AI Routes mounted at /api/ai
✅ Upload Routes mounted at /api/upload
```

---

## 📋 **Quick Checklist**

- [ ] Backend server running on port 3001
- [ ] Frontend server running on port 5173
- [ ] `.env` file exists with `VITE_BACKEND_URL=http://localhost:3001`
- [ ] No firewall blocking localhost connections
- [ ] `node_modules` installed (`npm install`)

---

## 🎯 **Expected Output After Fix**

When you upload a file, you should see:

**Browser Console:**
```
📡 API Request: POST /api/upload
✅ API Response: POST /api/upload - 200
```

**Backend Console:**
```
[Upload] Processing: Q11.docx (1.2MB)
[Parser] Parsing for questions (Level: Medium)
[Success] Inserted 25 questions
```

---

## ⚡ **Next Steps**

1. **Start backend**: `npm run server` in one terminal
2. **Start frontend**: `npm run client` in another terminal
3. **Try upload again** in the browser
4. **Check both consoles** for success messages

---

## 🆘 **Still Not Working?**

Run this diagnostic:
```bash
# Check if Node.js is installed
node --version

# Check if npm is installed
npm --version

# Check if backend dependencies are installed
ls node_modules/express

# Try starting backend with verbose logging
NODE_ENV=development npm run server
```

If you see errors about missing packages, run:
```bash
npm install express cors multer dotenv openai
```
