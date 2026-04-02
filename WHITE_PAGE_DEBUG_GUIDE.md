# 🚨 White Page Debugging Guide

## Current Status
You're seeing a white page at: `https://aitutor-4431c.web.app/#/student`

This means the app is crashing but not showing any errors. Here's how to debug it:

---

## 🔍 Step 1: Open Browser Console

### **Chrome/Edge:**
1. Press `F12` or `Ctrl+Shift+I`
2. Click on **Console** tab
3. Look for RED errors

### **Firefox:**
1. Press `F12` or `Ctrl+Shift+I`
2. Click on **Console** tab
3. Look for RED errors

---

## 📋 Step 2: What to Look For

### **✅ Expected Logs (Good):**
```
🔐 [Auth] State Change: SIGNED_IN
🔍 [DEBUG] rawData changed: {enrollments: [], progress: [], ...}
🔍 [DEBUG] user object: {id: "...", email: "...", ...}
📊 Loading dashboard data for user: xxx-xxx test@example.com
```

### **❌ Error Messages (Bad - Copy These!):**
```
Uncaught TypeError: Cannot read property 'id' of undefined
ReferenceError: user is not defined
Error: Failed to fetch
```

**If you see errors, COPY THEM and send them to me!**

---

## 🛠️ Step 3: Manual Debug Test

Open browser console on the white page and run:

```javascript
// Check if React app loaded
console.log('React app status:', {
  hasUser: !!window.user,
  location: window.location.hash,
  userAgent: navigator.userAgent
});
```

---

## 💡 Common Causes & Fixes

### **Cause 1: Auth State Not Loaded**
**Symptom:** Console shows `user is undefined`

**Fix:** Wait 2-3 seconds, then refresh

---

### **Cause 2: Database Connection Failed**
**Symptom:** Console shows `Failed to fetch` or `Network error`

**Fix:** 
1. Check internet connection
2. Verify Supabase is online: https://wqavuacgbawhgcdxxzom.supabase.co

---

### **Cause 3: RLS Policy Blocking Data**
**Symptom:** Console shows empty arrays but no errors

**Fix:** Run this SQL in Supabase:
```sql
-- Check your user exists
SELECT id, email FROM auth.users WHERE email = 'YOUR_EMAIL';

-- Check profile exists
SELECT id, email, name FROM profiles WHERE email = 'YOUR_EMAIL';

-- If profile missing, create it:
INSERT INTO profiles (id, email, name, role)
SELECT id, email, raw_user_meta_data->>'name', 'student'
FROM auth.users 
WHERE email = 'YOUR_EMAIL'
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = COALESCE(EXCLUDED.name, profiles.name);
```

---

### **Cause 4: HashRouter Issue**
**Symptom:** URL shows `#/student` but page blank

**Try:** 
1. Go to: `https://aitutor-4431c.web.app/`
2. Login from there
3. Navigate to student dashboard

---

## 🧪 Step 4: Test Alternative Routes

### **Test A: Direct Login**
```
https://aitutor-4431c.web.app/login
```
Login → See if redirects work

### **Test B: Student Dashboard with Query Param**
```
https://aitutor-4431c.web.app/#/student?debug=true
```
Check console for debug logs

### **Test C: Different Browser**
Try in Incognito mode or different browser

---

## 📊 Step 5: Check Network Tab

1. Open DevTools (`F12`)
2. Go to **Network** tab
3. Refresh page
4. Look for RED failed requests

**Common failures:**
- `/profiles` - RLS blocking
- `/enrollments` - Missing data
- Supabase URLs - Connection issue

---

## ⚡ Quick Fixes to Try

### **Fix #1: Hard Refresh**
```
Ctrl + Shift + R (Windows)
Cmd + Shift + R (Mac)
```

### **Fix #2: Clear Cache**
1. Open DevTools
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"

### **Fix #3: Manual Navigation**
1. Go to: `https://aitutor-4431c.web.app/`
2. Click "Login"
3. Enter credentials
4. See where it redirects

### **Fix #4: Check LocalStorage**
Run in console:
```javascript
// Check stored auth state
console.log('LocalStorage:', {
  supabaseToken: localStorage.getItem('sb-wqavuacgbawhgcdxxzom-auth-token'),
  userEmail: localStorage.getItem('userEmail')
});
```

---

## 🎯 What I Need From You

**Please provide:**

1. **Browser Console Errors** (copy/paste ALL red text)
2. **Network Tab Errors** (any failed requests?)
3. **Your Email** (to check database records)
4. **Browser Name & Version** (Chrome? Firefox?)

---

## 🔧 Advanced Debugging

### **Add Extra Logging:**

Temporarily add this to `main.jsx` line 55:

```javascript
<ErrorBoundary>
  <div id="debug-root" />
  <HashRouter>
    // ... rest of code
```

Then check browser console for React mounting issues.

### **Check Auth State:**

Run in console:
```javascript
// Force auth check
import supabase from './supabase/supabase.js';
supabase.auth.getSession().then(({ data }) => {
  console.log('Current session:', data.session);
  console.log('Current user:', data.user);
});
```

---

## 📞 Emergency Fallback

If nothing works, try:

1. **Logout completely:**
   ```javascript
   localStorage.clear();
   window.location.reload();
   ```

2. **Re-login from homepage:**
   ```
   https://aitutor-4431c.web.app/
   ```

3. **Use incognito mode** to rule out cache issues

---

## ✅ Success Indicators

You'll know it's working when you see:

```
✅ [Auth] Profile sync successful: student
📊 Dashboard data loaded: {enrollments: 0, progress: 0, ...}
```

And the page shows:
- Welcome message with your name
- Score cards
- Course list
- Progress indicators

---

**Send me the console errors and I can pinpoint the exact issue!** 🎯
