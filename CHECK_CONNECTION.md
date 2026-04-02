# 🔍 CONNECTION DIAGNOSTIC CHECKLIST

## Run These Commands in Order

### 1️⃣ Check if Backend is Running

```bash
curl http://localhost:3001/api/health
```

**✅ Success Response:**
```json
{"status":"ok","message":"Server is active"}
```

**❌ If you get "Connection refused":**
- Backend is NOT running
- **FIX:** Run `npm run server` in a terminal

---

### 2️⃣ Verify Upload Route is Registered

```bash
curl http://localhost:3001/api/upload/test
```

**✅ Success Response:**
```json
{"message":"Upload routes are working!","maxFileSize":"2GB"}
```

**❌ If you get 404:**
- Upload routes failed to load
- Check backend terminal for errors
- **FIX:** Restart backend with `npm run server`

---

### 3️⃣ Check All Routes

```bash
curl http://localhost:3001/api/debug/routes
```

**✅ You should see:**
```json
{
  "message": "Registered API Routes",
  "routesLoaded": {
    "ai": true,
    "upload": true,
    "payment": true
  },
  "routes": [...]
}
```

**❌ If `upload: false`:**
- Upload module failed to load
- Check for syntax errors in `src/server/routes/upload.js`

---

### 4️⃣ Test from Browser Console

Open browser console (F12) and run:

```javascript
fetch('http://localhost:3001/api/health')
  .then(r => r.json())
  .then(d => console.log('✅ Backend connected:', d))
  .catch(e => console.error('❌ Backend not reachable:', e));
```

**✅ Success:** You'll see the health response
**❌ Failure:** "Failed to fetch" or "Connection refused"

---

## 🎯 Quick Diagnostic Script

Run this to check everything automatically:

```bash
node check-backend.js
```

---

## 🚨 **If ANY Command Fails**

### The backend is NOT running properly.

**Fix:**

1. **Stop any running backend process** (Ctrl+C)
2. **Clear any stuck processes:**
   ```bash
   # Windows
   taskkill /F /IM node.exe
   
   # Mac/Linux
   killall node
   ```
3. **Restart backend:**
   ```bash
   npm run server
   ```
4. **Wait for "Server running" message**
5. **Run the diagnostic commands again**

---

## ✅ **All Tests Pass?**

If all 4 commands above work:

1. ✅ Backend is running correctly
2. ✅ Routes are registered
3. ✅ Upload endpoint is accessible
4. ✅ **You can now upload files!**

Go to: http://localhost:5173 and try the upload again.

---

## 📊 **Status Indicators**

| Check | Command | Expected Result |
|-------|---------|----------------|
| Backend Running | `curl http://localhost:3001/api/health` | `{"status":"ok"}` |
| Upload Route | `curl http://localhost:3001/api/upload/test` | `{"message":"Upload routes are working!"}` |
| All Routes | `curl http://localhost:3001/api/debug/routes` | JSON with routes list |
| Frontend Access | Open http://localhost:5173 | App loads |

**All must pass for uploads to work!**

---

## 🔥 **Emergency Reset**

If nothing works, do a complete reset:

```bash
# 1. Kill all Node processes
taskkill /F /IM node.exe  # Windows
killall node              # Mac/Linux

# 2. Clean install
rm -rf node_modules package-lock.json
npm install

# 3. Start fresh
npm run dev
```

---

## 💡 **Pro Tip**

Keep this command running in a terminal:

```bash
npm run dev
```

This ensures both frontend and backend are always running together!
