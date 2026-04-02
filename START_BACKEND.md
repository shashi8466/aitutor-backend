# 🚀 START BACKEND SERVER - SIMPLE GUIDE

## The Problem
```
❌ Backend server is not responding
```

This means the Express server at `http://localhost:3001` is **NOT running**.

---

## ✅ The Solution

### **Just Run This Command:**

```bash
npm run server
```

---

## **What You Should See:**

After running the command, you **MUST** see these messages:

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
```

**If you see this, you're good to go!** ✅

**If you DON'T see this, read the troubleshooting section below.** ⬇️

---

## **Quick Test:**

Open a **NEW terminal** (keep backend running) and run:

```bash
curl http://localhost:3001/api/health
```

**Expected:**
```json
{"status":"ok","message":"Server is active"}
```

---

## **Then Try Upload:**

1. ✅ Backend is running (you saw the success message)
2. ✅ Go to http://localhost:5173
3. ✅ Login as admin
4. ✅ Upload Q11.docx

**It will work!** 🎉

---

## 🔧 Troubleshooting

### Error: "Cannot find module 'express'"

**Fix:**
```bash
npm install
```

Then try `npm run server` again.

---

### Error: "Port 3001 is already in use"

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

Then try `npm run server` again.

---

### Error: Backend starts but crashes immediately

**Check the error message** in red text.

**Common fixes:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Try again
npm run server
```

---

## 💡 Alternative: Start Both at Once

Instead of starting backend and frontend separately, run:

```bash
npm run dev
```

This starts **both** servers together! ✨

---

## ✅ **Success Checklist**

Before trying upload, verify:

- [ ] Backend terminal shows "SERVER SUCCESSFULLY STARTED"
- [ ] You see "✅ Upload Routes mounted at /api/upload"
- [ ] `curl http://localhost:3001/api/health` returns success
- [ ] Frontend is accessible at http://localhost:5173
- [ ] No red error messages in backend terminal

---

## 🎯 **The Fastest Way**

**Just run:**
```bash
npm run dev
```

**Wait 15 seconds**, then try uploading!

---

## 📞 **Common Questions**

**Q: Do I need to keep the terminal open?**
A: Yes! The backend must stay running while you use the app.

**Q: Can I use the app without the backend?**
A: No. The upload feature requires the backend server.

**Q: What if I close the terminal by accident?**
A: Just run `npm run server` again to restart it.

---

**NOW GO START IT!** 🚀
