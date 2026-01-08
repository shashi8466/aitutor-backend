# 🧪 UPLOAD TEST PROCEDURE

## Before Testing

### 1. Verify Backend is Running

```bash
curl http://localhost:3001/api/health
```

**Expected:**
```json
{"status":"ok"}
```

### 2. Test Upload Endpoint

```bash
curl http://localhost:3001/api/upload/test
```

**Expected:**
```json
{
  "message": "Upload routes are working!",
  "maxFileSize": "2GB",
  "supportedFormats": ["docx", "txt", "pdf", "mp4"]
}
```

### 3. Check Supabase Storage

Go to: https://supabase.com/dashboard/project/wqavuacgbawhgcdxxzom/storage/buckets

**Verify:**
- ✅ `course_content` bucket exists
- ✅ Bucket is marked as "Public"
- ✅ Configuration shows 2GB file size limit

---

## Manual Upload Test (Using cURL)

If browser upload fails, test with cURL:

```bash
curl -X POST http://localhost:3001/api/upload \
  -H "Content-Type: multipart/form-data" \
  -F "file=@./Q11.docx" \
  -F "courseId=1" \
  -F "category=quiz_document" \
  -F "level=Medium" \
  -F "parse=true"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Successfully imported 25 questions!",
  "count": 25
}
```

---

## What to Watch For

### Backend Terminal Should Show:

```
📤 [UPLOAD] New upload request received
✅ [UPLOAD] File received: { name: 'Q11.docx', size: '1.2MB' }
📋 [UPLOAD] Metadata: { courseId: '1', category: 'quiz_document', ... }
☁️ [UPLOAD] Uploading to storage: 1/1234567890_Q11.docx
✅ [STORAGE] File uploaded successfully
🔗 [STORAGE] Public URL: https://wqavuacgbawhgcdxxzom.supabase.co/...
🔍 [PARSER] Starting question extraction...
✅ [PARSER] Extracted 25 questions
✅ [DB] Inserted 25 questions
✅ [UPLOAD] Completed successfully
```

### Browser Console Should Show:

```
📡 API Request: POST /api/upload
✅ API Response: POST /api/upload - 200
```

---

## Common Failure Points

### ❌ Connection Refused
**Cause:** Backend not running  
**Fix:** `npm run server`

### ❌ 404 Not Found
**Cause:** Upload route not registered  
**Fix:** Check backend logs for route loading errors

### ❌ 403 Forbidden
**Cause:** Supabase storage permissions  
**Fix:** Run storage migration SQL (see DIAGNOSE_AND_FIX.md Step 4)

### ❌ 413 Payload Too Large
**Cause:** File size exceeds limit  
**Fix:** Already fixed in upload.js (2GB limit)

### ❌ Storage Upload Failed
**Cause:** Bucket doesn't exist or wrong permissions  
**Fix:** Create bucket in Supabase dashboard

---

## Success Checklist

- [ ] Backend shows "Server running on http://0.0.0.0:3001"
- [ ] Health check returns `{"status":"ok"}`
- [ ] Upload test endpoint returns success
- [ ] Supabase bucket exists and is public
- [ ] cURL test completes without errors
- [ ] Browser upload shows success message
- [ ] Questions appear in database

---

## If ALL Steps Pass But Still Fails

### Check Browser Network Tab (F12 → Network)

1. Click on the failed `/api/upload` request
2. Check **Request Headers** - should have `Content-Type: multipart/form-data`
3. Check **Response** - what error message is shown?
4. Check **Status Code** - is it 404, 500, or connection refused?

### Screenshot These for Debugging:
- Backend terminal output
- Browser console errors
- Network tab request details
- Supabase storage bucket settings

---

## 🎯 The Ultimate Test

Run this complete diagnostic:

```bash
# 1. Check backend
curl http://localhost:3001/api/health

# 2. Check routes
curl http://localhost:3001/api/debug/routes

# 3. Test upload endpoint
curl http://localhost:3001/api/upload/test

# 4. Try actual upload
curl -X POST http://localhost:3001/api/upload \
  -F "file=@./Q11.docx" \
  -F "courseId=1" \
  -F "parse=true"
```

**If ALL 4 commands work, the backend is perfect.**  
**The issue would then be in the frontend Axios configuration.**