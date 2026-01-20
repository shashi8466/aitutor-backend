# 🔧 Fix BUCKET_NAME Error

## ✅ **Good News: Course Created Successfully!**

Your course was saved! Now we just need to fix the file upload.

---

## ❌ **The Problem:**

The backend server is missing the `BUCKET_NAME` environment variable, which is needed for uploading files to Supabase Storage.

**Error:** `BUCKET_NAME is not defined`

---

## 🛠️ **The Fix:**

### **Step 1: Open your `.env` file**

Located at: `c:\Users\user\Downloads\-ai (1)\-ai (1)\educational-ai\.env`

### **Step 2: Add BUCKET_NAME**

Add this line to your `.env` file:

```env
BUCKET_NAME=course-materials
```

Your `.env` should look like this:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://wqavuacgbawhgcdxxzom.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Backend Configuration (for file uploads)
PORT=3001
SUPABASE_URL=https://wqavuacgbawhgcdxxzom.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
BUCKET_NAME=course-materials
```

### **Step 3: Create the Storage Bucket in Supabase**

1. Go to **Supabase Dashboard** → https://supabase.com/dashboard
2. Click your **aitutor** project
3. Click **Storage** (in left sidebar)
4. Click **"New Bucket"**
5. **Bucket name:** `course-materials`
6. **Public bucket:** ✅ Yes (check this)
7. Click **"Create bucket"**

### **Step 4: Restart the Backend Server**

Stop the backend server (if running) and start it again:

```bash
# Stop it with Ctrl+C, then:
npm run server
```

### **Step 5: Try Uploading Again**

1. Go back to your course form
2. Upload the files again
3. Click "Save Changes"
4. **Should work!** ✅

---

## 📋 **Quick Checklist:**

- [ ] Added `BUCKET_NAME=course-materials` to `.env`
- [ ] Created `course-materials` bucket in Supabase Storage
- [ ] Set bucket to PUBLIC
- [ ] Restarted backend server
- [ ] Tried uploading files again

---

## 🎯 **Alternative: Let Course Creation Work Without Files**

If you don't want to set up file uploads right now, you can:

1. **Create the course** without uploading files
2. Click "Save Changes" (don't upload any files)
3. **Course will be created successfully!**
4. Add files later when backend is configured

---

## ✅ **What's Working:**

- ✅ Course creation (database)
- ✅ Enrollment key generation (if you checked the box)
- ⏳ File uploads (needs BUCKET_NAME fix)

---

**Follow these steps and file uploads will work!** 🚀
