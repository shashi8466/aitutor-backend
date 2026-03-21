# 🔐 Fix 401 Unauthorized Error - Admin Notifications

## Problem
When accessing `/admin/notifications`, you see:
- **401 Unauthorized** error in browser console
- "No students found" (even though students exist)
- Loading spinner forever or empty table

---

## Root Causes

### Cause 1: Not Logged In as Admin ❌
Your user account doesn't have `role = 'admin'` in the database.

### Cause 2: RLS Policies Missing 🔒
Database Row Level Security is blocking the query.

### Cause 3: Token Not Sent 🎫
Frontend isn't sending the auth token to backend.

---

## Step-by-Step Fix

### STEP 1: Check Your Admin Role ⭐

**Run this in Supabase SQL Editor:**

```sql
-- Find your user
SELECT 
  id,
  email,
  name,
  role,
  created_at
FROM profiles
WHERE email = 'YOUR_EMAIL'; -- Replace with YOUR admin email
```

**Expected Result:**
```
| id | email | name | role | created_at |
|----|-------|------|------|------------|
| ... | admin@example.com | Admin Name | admin | 2025-01-01 |
```

**If role is NOT 'admin':**

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'YOUR_EMAIL'; -- Replace with your email
```

Then logout and login again to refresh your session.

---

### STEP 2: Verify RLS Policies Exist

**Run this in Supabase SQL Editor:**

```sql
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
AND policyname LIKE '%admin%';
```

**Expected: Should show these policies:**
1. `admin_select_all_profiles` → FOR SELECT
2. `admin_update_notifications` → FOR UPDATE

**If missing, run:**

```sql
-- Allow admins to view all profiles
DROP POLICY IF EXISTS admin_select_all_profiles ON profiles;
CREATE POLICY admin_select_all_profiles ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to update notification preferences
DROP POLICY IF EXISTS admin_update_notifications ON profiles;
CREATE POLICY admin_update_notifications ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

---

### STEP 3: Test Database Query Directly

**Run this in Supabase SQL Editor (while logged in as admin):**

```sql
-- This simulates what the backend does
SELECT 
  id,
  name,
  email,
  role,
  last_active_at,
  notification_preferences
FROM profiles
WHERE role = 'student'
ORDER BY name;
```

**Results:**
- ✅ **Returns rows** → Database has students, issue is authentication/RLS
- ❌ **Returns 0 rows** → You have no students in database

**If 0 students, create one:**

```sql
-- Either have users sign up through the app
-- OR manually insert a test student:
INSERT INTO profiles (id, email, name, role)
VALUES (
  '00000000-0000-0000-0000-000000000000', -- Generate UUID
  'test.student@example.com',
  'Test Student',
  'student'
);
```

---

### STEP 4: Check Backend Logs

**In your terminal where backend is running:**

When you access `/admin/notifications`, look for these logs:

**✅ SUCCESS Flow:**
```
🔐 [Admin Auth] Checking authorization...
  - Auth Header: Present
  - Token length: 200+
  ✅ Token valid for user: admin@example.com
✅ [Admin Auth] Authorized as admin
📊 [Admin Notifications] Fetching students...
✅ [Admin Notifications] Found 5 students
```

**❌ ERROR - No Token:**
```
🔐 [Admin Auth] Checking authorization...
  - Auth Header: ❌ Missing
❌ [Admin Auth] No Bearer token found
```
→ Frontend isn't sending token. Check browser network tab.

**❌ ERROR - Invalid Token:**
```
🔐 [Admin Auth] Checking authorization...
  - Auth Header: Present
  - Token length: 200+
❌ [Admin Auth] Invalid token: Invalid JWT
```
→ Logout and login again. Token expired.

**❌ ERROR - Not Admin:**
```
🔐 [Admin Auth] Checking authorization...
  ...
❌ [Admin Auth] User is not admin. Role: student
```
→ Run STEP 1 to set your role to admin.

**❌ ERROR - Profile Lookup Failed:**
```
❌ [Admin Auth] Profile lookup failed: relation "profiles" does not exist
```
→ Database schema issue. Run `FIX_NOTIFICATION_DATABASE.sql`

---

### STEP 5: Browser Console Debugging

**Open DevTools (F12) → Console tab**

**Test if you're logged in:**
```javascript
// Check current session
supabase.auth.getSession().then(({ data: { session } }) => {
  console.log('Session:', session?.user);
  console.log('Access token:', session?.access_token ? 'Present' : 'Missing');
});
```

**Expected output:**
```
Session: { id: "...", email: "admin@example.com", ... }
Access token: Present
```

**If session is null:**
→ You're not logged in. Go to `/login` and login as admin.

**Check your role:**
```javascript
// Get your profile
supabase.auth.getSession().then(async ({ data: { session } }) => {
  if (!session) return console.log('Not logged in');
  
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();
    
  console.log('Your role:', data?.role);
});
```

**Expected:**
```
Your role: admin
```

---

### STEP 6: Network Tab Inspection

**Open DevTools → Network tab**

1. Clear network log (trash icon)
2. Refresh `/admin/notifications` page
3. Find request to: `/api/admin/students-with-preferences`
4. Click on it
5. Check **Headers** tab

**Request Headers should show:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**If Authorization header is MISSING:**
→ Frontend bug. The axios interceptor isn't adding the token.

**Response should be:**
```json
{
  "success": true,
  "students": [...]
}
```

**If response is 401:**
```json
{
  "error": "Unauthorized",
  "details": "..."
}
```
→ Read the `details` field for specific error.

---

### STEP 7: Quick Test API Call

**In browser console, run this:**

```javascript
// Get token
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

if (!token) {
  console.error('❌ Not logged in!');
} else {
  console.log('✅ Token obtained, testing API...');
  
  // Test the endpoint
  fetch('/api/admin/students-with-preferences', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(r => r.json())
  .then(data => {
    console.log('API Response:', data);
    if (data.success) {
      console.log(`✅ Found ${data.students.length} students`);
      console.log('First student:', data.students[0]);
    } else {
      console.error('❌ API Error:', data);
    }
  })
  .catch(err => console.error('❌ Network Error:', err));
}
```

**Expected output:**
```
✅ Token obtained, testing API...
📊 [Admin Notifications] Fetching students...
✅ [Admin Notifications] Found 5 students
API Response: { success: true, students: [...] }
✅ Found 5 students
First student: { id: "...", name: "John Doe", ... }
```

**If you see 401:**
→ Check the detailed error message in the response.

---

## Common Scenarios & Fixes

### Scenario A: "Invalid JWT" Error
**Fix:** Logout and login again. Token expired.

### Scenario B: "Your role is 'student'" Error
**Fix:** Run STEP 1 to update your role to admin.

### Scenario C: "No authorization header" Error
**Fix:** Frontend isn't sending token. Check axios interceptor code.

### Scenario D: "Profile lookup failed" Error
**Fix:** Run `FIX_NOTIFICATION_DATABASE.sql` to ensure profiles table exists.

### Scenario E: Returns 0 students but logs say success
**Fix:** You genuinely have no students. Create accounts or have users sign up.

---

## Nuclear Option: Disable RLS Temporarily

**⚠️ WARNING: Only for testing! Re-enable after debugging!**

```sql
-- Disable RLS completely (DANGEROUS!)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Test the notification page now
-- If it works, the issue is definitely RLS policies

-- RE-ENABLE RLS AFTER TESTING!
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

---

## Verification Checklist

After fixing, verify:

- [ ] Your user has `role = 'admin'` in database
- [ ] RLS policies exist (`admin_select_all_profiles`, `admin_update_notifications`)
- [ ] Backend logs show: `✅ [Admin Auth] Authorized as admin`
- [ ] Backend logs show: `✅ [Admin Notifications] Found X students`
- [ ] Browser network tab shows 200 OK (not 401)
- [ ] API response includes `{ success: true, students: [...] }`
- [ ] UI displays student count > 0
- [ ] Table shows student rows

---

## Still Not Working?

### Enable Maximum Debugging

Add to `.env`:
```bash
DEBUG=*
NODE_ENV=development
```

Restart backend and watch for detailed logs.

### Check Supabase Service Key

Make sure your backend is using the **service role key** (not anon key):

In `src/supabase/supabaseAdmin.js`:
```javascript
createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // Must be service key!
  { auth: { persistSession: false } }
)
```

Service key bypasses RLS for admin operations.

---

## Contact Support Info

If still stuck, provide:
1. Screenshot of backend logs (with emoji icons)
2. Browser console output from STEP 7 test
3. Network tab screenshot showing the 401 response
4. Results from STEP 1 (your user role)
5. Results from STEP 2 (RLS policies)

This will help identify the exact issue quickly.

---

**Last Updated:** January 2025  
**Applies To:** Admin Notification Management v1.0
