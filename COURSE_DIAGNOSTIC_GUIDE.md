# 🔍 Fix: "No Courses Found" Issue

## Problem
You're seeing "No courses found" or "No new courses available at the moment" even though admin created courses.

---

## Root Causes (Most Common First)

### 1. **RLS Policies Blocking Access** 🔒 (90% likely)
Database Row Level Security is preventing users from seeing courses.

### 2. **No Courses in Database** 📭
Admin hasn't actually created courses yet, or creation failed.

### 3. **Backend API Error** ❌
Backend server has issues fetching courses from database.

### 4. **Frontend Not Fetching** 🖥️
React component not calling the API correctly.

---

## Step-by-Step Diagnostic & Fix

### STEP 1: Quick Browser Test ⭐ (DO THIS FIRST)

1. Go to your app (any page)
2. Press **F12** to open browser console
3. **Copy entire content** of `DIAGNOSE_COURSES_BROWSER.js`
4. **Paste in console** and press Enter
5. Read the results

**Expected output if working:**
```
✅ Found 5 courses
   First course: {id: 1, name: "SAT Math Prep", ...}
✅ API returned 5 courses
```

**If it shows errors**, follow the recommendations it gives you.

---

### STEP 2: Check Backend Logs

In your terminal where backend is running, look for:

```
[timestamp] GET /api/tutor/courses
```

**Success logs:**
```
GET /api/tutor/courses 200 - 45ms
```

**Error logs to watch for:**
```
GET /api/tutor/courses 500 - Internal Server Error
Error fetching courses: relation "courses" does not exist
permission denied for table courses
```

---

### STEP 3: Run Database Diagnostic (If Step 1 Failed)

**Go to Supabase Dashboard → SQL Editor**

**Copy entire content** of `DIAGNOSE_COURSES_ISSUE.sql`

**Paste and click "Run"**

This will:
1. ✅ Check if courses table exists
2. ✅ Show how many courses exist
3. ✅ Check RLS policies
4. ✅ Fix RLS policies automatically
5. ✅ Show your user role
6. ✅ Test course access

**Look for this in the results:**

| Section | Value | What It Means |
|---------|-------|---------------|
| Total Courses | 5 | ✅ You have 5 courses |
| Total Courses | 0 | ❌ No courses exist |
| RLS Enabled | YES | ⚠️ RLS is active (need policies) |
| Your Role | admin | ✅ You're logged in as admin |
| Your Role | NOT LOGGED IN | ❌ Need to login |

---

### STEP 4: Fix Based on Results

#### Scenario A: "Total Courses: 0"

**Problem:** No courses in database

**Solution:**
1. Go to `/admin` (must be admin user)
2. Click **"Courses"** in sidebar
3. Click **"Add New Course"**
4. Fill in:
   - Course Name: "SAT Math Prep"
   - Description: "Complete SAT Math preparation"
   - Category: "SAT"
   - Level: "Medium"
5. Click **"Create Course"**
6. Verify it appears in the list

**Alternative via SQL:**
```sql
INSERT INTO courses (name, description, category, level)
VALUES 
  ('SAT Math Prep', 'Complete SAT Math preparation', 'SAT', 'Medium'),
  ('SAT English', 'Complete SAT English preparation', 'SAT', 'Medium');
```

---

#### Scenario B: "Total Courses: 5" but "Your Role: NOT LOGGED IN"

**Problem:** You're not logged in

**Solution:**
1. Logout
2. Login again with correct credentials
3. Refresh the page

---

#### Scenario C: "Total Courses: 5" but "RLS Enabled: YES"

**Problem:** RLS policies are blocking access

**Solution:** The SQL script in Step 3 already fixed this by creating:
```sql
"Anyone can view courses" - Allows all authenticated users to see courses
"Admins and tutors can manage courses" - Allows admins/tutors to CRUD courses
```

After running the script, refresh your app and courses should appear.

---

#### Scenario D: "Total Courses: 5" + "Your Role: admin" + Still Not Showing

**Problem:** Frontend issue or backend not responding

**Check Network Tab:**
1. Open DevTools → Network tab
2. Clear network log
3. Refresh the page
4. Look for request to: `/api/tutor/courses`
5. Click on it → Check response

**If status is 200 OK:**
- Backend is working
- Check the Response tab for course data
- If data exists, issue is in React component state

**If status is 500 Error:**
- Backend has an error
- Check backend terminal logs
- Likely database connection or query error

**If request is missing:**
- React component isn't calling the API
- Check component's useEffect hook
- Look for JavaScript errors in Console tab

---

### STEP 5: Verify Frontend Components

Check if the course components are properly fetching data:

**In Student Courses Page:**
```javascript
// Should have something like this:
useEffect(() => {
  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setCourses(data);
  };
  
  fetchCourses();
}, []);
```

**Check browser Console for errors:**
```
Uncaught ReferenceError: courses is not defined
TypeError: Cannot read property 'map' of undefined
```

These indicate the component state isn't being set properly.

---

## Complete System Checklist

Run through this checklist to verify everything works:

### Backend Checks:
- [ ] Backend server is running (check terminal)
- [ ] No errors in backend logs
- [ ] Database connection successful
- [ ] `/api/tutor/courses` endpoint returns 200
- [ ] Response includes courses array

### Database Checks:
- [ ] Courses table exists
- [ ] At least 1 course in database
- [ ] RLS policies allow SELECT for authenticated users
- [ ] Your user has a role (admin/tutor/student)

### Frontend Checks:
- [ ] Logged in (check browser console)
- [ ] User role is set correctly
- [ ] Component calls fetchCourses() on mount
- [ ] No JavaScript errors in console
- [ ] Network request to `/api/tutor/courses` succeeds
- [ ] State is updated with courses data
- [ ] UI renders the courses list

---

## Common Error Messages & Fixes

### Error: "relation 'courses' does not exist"
**Fix:** Database schema issue. Run migrations or create courses table manually.

### Error: "permission denied for table courses"
**Fix:** RLS policy issue. Run `DIAGNOSE_COURSES_ISSUE.sql` to fix policies.

### Error: "Cannot read property 'map' of undefined"
**Fix:** Frontend state issue. Component isn't setting courses state properly.

### Error: "Network request failed"
**Fix:** Backend server not running or CORS issue. Restart backend.

### Message: "No courses found"
**Could mean:**
1. No courses in database → Create courses
2. RLS blocking access → Fix RLS policies
3. API not called → Check component code

---

## Quick Fix Script (Nuclear Option)

If nothing else works, run this complete reset in Supabase SQL Editor:

```sql
-- 1. Ensure courses table exists
CREATE TABLE IF NOT EXISTS courses (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  level TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- 3. Drop old policies
DROP POLICY IF EXISTS "Anyone can view courses" ON courses;
DROP POLICY IF EXISTS "Admins and tutors can manage courses" ON courses;

-- 4. Create new permissive policies
CREATE POLICY "Anyone can view courses" ON courses
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and tutors can manage courses" ON courses
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor')));

-- 5. Insert sample courses
INSERT INTO courses (name, description, category, level) VALUES
  ('SAT Math Prep', 'Comprehensive SAT Math preparation course', 'SAT', 'Medium'),
  ('SAT English', 'Complete SAT English preparation', 'SAT', 'Medium');

-- 6. Verify
SELECT COUNT(*) as total_courses FROM courses;
```

Then restart backend and refresh frontend.

---

## Verification After Fix

After applying fixes, verify everything works:

### 1. In Admin Panel (`/admin`):
- Navigate to Courses section
- Should see list of all courses
- Can create/edit/delete courses

### 2. In Student View (`/student/courses`):
- Should see enrolled/available courses
- Can click on courses to view details
- No "No courses found" message

### 3. In Tutor View (`/tutor`):
- Should see assigned courses
- Can view student enrollments

---

## Files Created for Diagnostics

1. **`DIAGNOSE_COURSES_ISSUE.sql`** - Database diagnostic script
2. **`DIAGNOSE_COURSES_BROWSER.js`** - Browser console diagnostic
3. **`COURSE_DIAGNOSTIC_GUIDE.md`** - This guide

---

## Summary Flowchart

```
"No courses found"
    ↓
Run browser diagnostic (DIAGNOSE_COURSES_BROWSER.js)
    ↓
┌─────────────────┬─────────────────┬──────────────┐
│ No courses in DB│ RLS blocking    │ API error    │
│                 │                 │              │
│ Create courses  │ Run SQL script  │ Check backend│
│ in /admin       │ to fix RLS      │ logs         │
└─────────────────┴─────────────────┴──────────────┘
    ↓
Refresh page → Courses should appear ✅
```

---

**Last Updated:** January 2025  
**Status:** Ready to diagnose and fix  
**Estimated Fix Time:** 5-10 minutes depending on root cause
