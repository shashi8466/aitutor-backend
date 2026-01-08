# 🚨 COMPLETE NETWORK ERROR DIAGNOSIS & FIX

## Current Error
```
POST http://localhost:3001/api/upload net::ERR_CONNECTION_REFUSED
Warning: Q11.docx: Network Error
```

---

## 🔍 ROOT CAUSE ANALYSIS

This error happens when:
1. ❌ Backend server is NOT running on port 3001
2. ❌ Supabase storage bucket is not configured correctly
3. ❌ CORS is blocking the request
4. ❌ File size exceeds limits

---

## ✅ COMPLETE FIX - Follow ALL Steps

### **STEP 1: Verify Backend is Actually Running**

Open a terminal and run:

```bash
npm run server
```

**You MUST see ALL of these messages:**

```
🔧 Initializing AI Utils...
✅ AI Utils module loaded
🔧 Initializing Payment Routes...
✅ Payment Routes mounted at /api/payment
🤖 Initializing AI Routes...
✅ AI Routes module loaded successfully
🔗 Loading Routes...
✅ AI Routes mounted at /api/ai
✅ Upload Routes mounted at /api/upload

🚀 Server running on http://0.0.0.0:3001
🤖 AI Provider: OpenAI
📡 API Base: http://localhost:3001/api
🔍 Debug Routes: http://localhost:3001/api/debug/routes
```

**If you DON'T see these messages:**
- The backend failed to start
- Check for error messages in red
- Proceed to troubleshooting section below

---

### **STEP 2: Test Backend Connection**

**Open a NEW terminal** (keep backend running) and run:

```bash
curl http://localhost:3001/api/health
```

**Expected Response:**
```json
{"status":"ok","message":"Server is active","timestamp":"..."}
```

**If you get "Connection refused":**
- Backend is NOT running
- Go back to Step 1
- Do NOT proceed until this works

---

### **STEP 3: Fix Supabase Storage Bucket**

Go to your **Supabase Dashboard**:

1. **Navigate to Storage**
   - URL: https://supabase.com/dashboard/project/wqavuacgbawhgcdxxzom/storage/buckets

2. **Find or Create `course_content` Bucket**
   - If it doesn't exist, click "Create Bucket"
   - Name: `course_content`
   - ✅ Check "Public bucket"

3. **Configure Bucket Settings**
   - Click on the `course_content` bucket
   - Click "Configuration" (gear icon)
   - Set these values:
     - **File size limit**: `2147483648` (2GB in bytes)
     - **Allowed MIME types**: Leave EMPTY (allows all types)
     - **Public**: ✅ ENABLED

4. **Save Changes**

---

### **STEP 4: Run Storage Migration**

Go to **Supabase Dashboard → SQL Editor** and run this:

```sql
-- Force bucket configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course_content',
  'course_content',
  true,
  2147483648,  -- 2GB
  NULL         -- All types
)
ON CONFLICT (id) 
DO UPDATE SET
  public = true,
  file_size_limit = 2147483648,
  allowed_mime_types = NULL;

-- Fix storage policies
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;

-- Recreate policies
CREATE POLICY "Public Read Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'course_content');

CREATE POLICY "Authenticated Upload Access" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'course_content');

CREATE POLICY "Authenticated Update Access" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'course_content');

CREATE POLICY "Authenticated Delete Access" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'course_content');
```

---

### **STEP 5: Verify Environment Variables**

Check your `.env` file contains these EXACT values:

```env
# Backend URL - CRITICAL
VITE_BACKEND_URL=http://localhost:3001

# Supabase
VITE_SUPABASE_URL=https://wqavuacgbawhgcdxxzom.supabase.co
VITE_SUPABASE_ANON_KEY=your_key_here

# OpenAI (Your key)
OPENAI_API_KEY=your_openai_key_here
VITE_OPENAI_API_KEY=your_openai_key_here

# Server
PORT=3001
NODE_ENV=development
```

---

### **STEP 6: Restart Everything**

**Kill all running processes:**
- Press `Ctrl+C` in all terminals

**Then restart:**

```bash
npm run dev
```

**Wait 15 seconds** for both servers to fully start.

---

### **STEP 7: Test Upload Again**

1. Go to http://localhost:5173
2. Login as admin
3. Navigate to **Upload New** page
4. Select a course
5. Upload Q11.docx
6. **Watch the browser console (F12) for messages**

---

## 🔧 TROUBLESHOOTING

### Problem 1: Backend Won't Start

**Symptoms:**
- No "Server running" message
- Errors about missing modules

**Fix:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run server
```

---

### Problem 2: Port 3001 Already in Use

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

### Problem 3: CORS Error

**Symptoms:**
- Browser console shows CORS error
- Request is blocked

**Fix:**
The CORS configuration in `src/server/index.js` should already be correct:
```javascript
app.use(cors({
  origin: true,
  credentials: true
}));
```

If still blocked, temporarily change to:
```javascript
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

---

### Problem 4: File Size Limit

**Symptoms:**
- Small files work, large files fail
- Error mentions file size

**Fix:**

1. **Check Supabase bucket limit** (Step 3 above)
2. **Update backend multer config** in `src/server/routes/upload.js`:
   ```javascript
   const upload = multer({
     storage: multer.memoryStorage(),
     limits: {
       fileSize: 2 * 1024 * 1024 * 1024  // 2GB
     }
   });
   ```

---

## 🎯 VERIFICATION CHECKLIST

Before trying upload again, verify ALL of these:

- [ ] Backend terminal shows "Server running on http://0.0.0.0:3001"
- [ ] `curl http://localhost:3001/api/health` returns `{"status":"ok"}`
- [ ] `curl http://localhost:3001/api/debug/routes` shows `/api/upload` route
- [ ] Supabase `course_content` bucket exists and is public
- [ ] Storage policies are applied (run SQL from Step 4)
- [ ] `.env` file has correct `VITE_BACKEND_URL`
- [ ] Frontend is accessible at http://localhost:5173
- [ ] No firewall blocking localhost connections

---

## 🆘 LAST RESORT: Nuclear Reset

If nothing works, do a complete reset:

```bash
# 1. Kill all Node processes
taskkill /F /IM node.exe  # Windows
# killall node            # Mac/Linux

# 2. Clean everything
rm -rf node_modules package-lock.json dist

# 3. Reinstall
npm install

# 4. Restart
npm run dev
```

---

## 📊 EXPECTED BEHAVIOR WHEN WORKING

### Backend Console:
```
[2024-01-10T10:30:45.123Z] POST /api/upload
[Upload] Processing: Q11.docx (1.2MB)
[Parser] Parsing for questions (Level: Medium)
[Success] Inserted 25 questions
```

### Browser Console:
```
📡 API Request: POST /api/upload
✅ API Response: POST /api/upload - 200
```

### Admin Panel:
```
✅ Successfully imported 25 questions!
```

---

## 🎯 MOST COMMON MISTAKE

**90% of the time, the issue is:**

❌ **Backend is not running**

**Solution:**
```bash
npm run server
```

**Keep that terminal open!**

---

## 🔥 QUICK DIAGNOSTIC COMMAND

Run this to check everything at once:

```bash
node check-backend.js
```

This will test:
- ✅ Backend connection
- ✅ Health endpoint
- ✅ Routes registration

---

## 📞 STILL STUCK?

If you've followed ALL steps and it still doesn't work:

1. **Take screenshots of:**
   - Backend terminal output
   - Browser console (F12)
   - Network tab showing the failed request

2. **Check these specific things:**
   - Is another application using port 3001?
   - Is your antivirus blocking Node.js?
   - Are you behind a corporate firewall?
   - Is localhost resolving correctly? (try 127.0.0.1 instead)

3. **Try changing the port:**
   - In `.env`: `PORT=3002`
   - In `App.jsx`: `const BACKEND_URL='http://localhost:3002'`
   - Restart backend

---

## ✅ SUCCESS INDICATORS

You know it's working when:

1. ✅ Backend terminal shows "Server running"
2. ✅ Health check returns `{"status":"ok"}`
3. ✅ Upload completes without errors
4. ✅ Questions appear in the database
5. ✅ No red errors in browser console

---

## 🚀 FINAL COMMAND TO RUN

```bash
npm run dev
```

Then wait 15 seconds and try the upload again!