# 🔍 DEBUG GUIDE: "Verifying your access" Issue

## **Latest Updates (Critical Fixes Applied)**

### **Fix #1: Supabase getUser Timeout**
- Added 5-second timeout to `supabase.auth.getUser()` call
- Prevents hanging on slow/failing Supabase client initialization
- Falls back gracefully if timeout occurs

### **Fix #2: AuthContext Global Timeout**
- Added 8-second absolute max timeout for entire auth initialization
- Attempts localStorage recovery as last resort
- Always unblocks UI even if auth checks fail

### **Fix #3: Enhanced Debugging**
- Added extensive console logging throughout auth flow
- Track exactly where and why auth is hanging
- Clear error messages for troubleshooting

---

## 📊 **How to Debug the Issue**

### **Step 1: Open Browser Console**
1. Press **F12** or **Ctrl+Shift+I**
2. Go to **Console** tab
3. Refresh the page that's showing "Verifying your access"

### **Step 2: Look for These Key Messages**

#### **✅ Healthy Auth Flow:**
```
🔍 [AuthContext] Starting auth initialization...
🔍 [AuthContext] Checking session...
🔍 [AuthContext] Session result: FOUND USER
🚀 [AuthContext] Setting user from session: user@email.com
✅ [AuthContext] User set, unblocking UI
```

#### **❌ Problem Indicators:**

**Problem 1: Supabase getUser Hanging**
```
🔍 [AuthContext] Checking session...
[NO FURTHER MESSAGES FOR >5 SECONDS]
⏰ getUser timed out: getUser timeout
⚠️ No user from getUser: getUser timeout
```

**Problem 2: Auth Init Timeout**
```
🔍 [AuthContext] Starting auth initialization...
🔍 [AuthContext] Checking session...
[8 seconds pass]
🚨 [AuthContext] Auth init timeout - forcing loading=false
⚠️ [AuthContext] Recovered user from localStorage after timeout
```

**Problem 3: Auth State Change Not Firing**
```
🔍 [AuthContext] Starting auth initialization...
✅ [AuthContext] User set, unblocking UI
[But ProtectedRoute still shows "Verifying"]
→ Check if auth state change listener is working
```

---

## 🔧 **Troubleshooting Steps**

### **Test 1: Check Supabase Configuration**

In browser console, run:
```javascript
// Test Supabase connection
import supabase from './supabase/supabase';
const { data, error } = await supabase.auth.getSession();
console.log('Session:', data);
console.log('Error:', error);
```

**Expected Result:**
- ✅ Should return session data quickly (<2 seconds)
- ❌ If hangs → Supabase client misconfigured

**Solution:**
- Check `.env` file has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Verify Supabase project is active
- Check network connectivity to Supabase

---

### **Test 2: Check LocalStorage**

In browser console, run:
```javascript
// Check for Supabase session
const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
console.log('Supabase keys:', keys);

if (keys.length > 0) {
  const session = JSON.parse(localStorage.getItem(keys[0]));
  console.log('Session data:', session);
}

// Check cached profiles
const profiles = Object.keys(localStorage).filter(k => k.startsWith('auth_profile_'));
console.log('Cached profiles:', profiles);
```

**Expected Result:**
- ✅ Should find at least one Supabase key
- ✅ Should have session data with user object
- ❌ If empty → User not logged in or session expired

**Solution:**
- Log in again
- Check if login is properly saving session
- Verify Supabase auth is working

---

### **Test 3: Check Network Requests**

1. Open **Network** tab (F12 → Network)
2. Refresh page
3. Look for:
   - `/auth/v1/token` calls to Supabase
   - `/api/*` calls to backend

**What to Look For:**
- ✅ Quick responses (<2s) with 200 status
- ⚠️ Slow responses (>5s)
- ❌ Failed requests (red, 4xx/5xx errors)
- ❌ Pending requests stuck in "(pending)" state

**Common Issues:**

**Issue A: Supabase Token Request Hanging**
- Request to `https://*.supabase.co/auth/v1/token?grant_type=refresh_token` hangs
- **Cause:** Network issue, firewall, or Supabase outage
- **Fix:** Check internet, try different network, verify Supabase status

**Issue B: Backend API Requests Hanging**
- Requests to `/api/*` endpoints hang
- **Cause:** Backend server down or slow
- **Fix:** Restart backend, check Render.com status, verify BACKEND_URL

---

### **Test 4: Manual Auth Recovery**

If stuck on "Verifying your access", try this in console:

```javascript
// Force clear auth state and reload
localStorage.clear();
location.reload();
```

This will:
- Clear all cached data
- Force fresh login
- Often resolves stuck states

---

## 🎯 **Expected Behavior After Fixes**

### **Scenario 1: Normal Login & Refresh**
1. User logs in successfully
2. Dashboard loads immediately
3. **On refresh:**
   - Console shows: `🔍 [AuthContext] Checking session...`
   - Within 1-2 seconds: `✅ [AuthContext] User set, unblocking UI`
   - Dashboard appears within 3-5 seconds total

### **Scenario 2: Slow Network/Server**
1. User refreshes dashboard
2. Console shows: `🔍 [AuthContext] Checking session...`
3. Takes 5-7 seconds
4. Either:
   - ✅ Success: `🚀 [AuthContext] Setting user from session`
   - ⚠️ Timeout: `⏰ getUser timed out` → Falls back to localStorage
5. Dashboard loads within 8 seconds max

### **Scenario 3: Complete Failure**
1. User refreshes dashboard
2. Console shows: `🔍 [AuthContext] Checking session...`
3. After 8 seconds: `🚨 [AuthContext] Auth init timeout - forcing loading=false`
4. Tries localStorage recovery
5. If recovery fails → Shows login page
6. **NEVER shows infinite "Verifying your access"**

---

## 🐛 **Known Edge Cases**

### **Edge Case 1: Corrupted LocalStorage**
**Symptoms:**
- Console shows: `Failed to parse cached profile`
- Auth keeps trying to use invalid data

**Solution:**
```javascript
// In console, run:
localStorage.clear();
location.reload();
```

---

### **Edge Case 2: Multiple Tabs Open**
**Symptoms:**
- One tab works, another stuck on "Verifying"
- Auth state out of sync between tabs

**Solution:**
- Close all tabs
- Open fresh tab
- Log in again

---

### **Edge Case 3: Browser Extensions Interfering**
**Symptoms:**
- Incognito mode works fine
- Normal mode hangs

**Cause:** Privacy extensions blocking Supabase cookies/localStorage

**Solution:**
- Disable extensions for your app
- Or use incognito/private browsing

---

## 📞 **What to Share for Support**

If still experiencing issues, provide:

### **1. Console Logs**
Copy entire console output from:
- Page refresh
- Wait 10 seconds
- Copy all messages (including red errors)

### **2. Network Tab**
Screenshot showing:
- All requests during page load
- Highlight any stuck in "(pending)"
- Show response times

### **3. LocalStorage Data**
Run in console:
```javascript
const data = {};
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('sb-') || key.startsWith('auth_profile_')) {
    try {
      data[key] = JSON.parse(localStorage.getItem(key));
    } catch(e) {
      data[key] = 'PARSE_ERROR';
    }
  }
});
console.log(JSON.stringify(data, null, 2));
```

### **4. Environment Info**
- Browser version
- Operating system
- Hosting environment (Firebase, localhost, etc.)
- Backend URL being used

---

## 🚀 **Performance Targets**

After all fixes, auth should complete within:

| Scenario | Target Time | Max Time |
|----------|-------------|----------|
| Cached session | <1 second | 2 seconds |
| Fresh session | 2-3 seconds | 5 seconds |
| Slow network | 5-7 seconds | 8 seconds |
| Complete failure | N/A | 8 seconds (then show error) |

**CRITICAL:** Should **NEVER** show "Verifying your access" for more than 8 seconds.

---

## 📝 **Quick Reference: Console Commands**

```javascript
// 1. Check Supabase session
const { data } = await supabase.auth.getSession();
console.log('Session:', data);

// 2. Check localStorage
const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-'));
console.log('Keys:', keys);

// 3. Manually trigger auth init
// (Run after clearing everything to test fresh login)
localStorage.clear();
location.reload();

// 4. Force logout and clear
supabase.auth.signOut();
localStorage.clear();
location.reload();

// 5. Check current auth state
const authState = {
  hasSession: !!localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))),
  hasProfile: !!localStorage.getItem(`auth_profile_${user?.id}`),
  user: user
};
console.log('Auth State:', authState);
```

---

## ✅ **Success Criteria**

You'll know the fix is working when:

1. ✅ **Login works**: Can log in without issues
2. ✅ **Refresh works**: Dashboard loads on refresh within 5 seconds
3. ✅ **No infinite spinners**: Never see "Verifying your access" for >8 seconds
4. ✅ **Clear errors**: If something fails, see helpful error messages
5. ✅ **Auto-recovery**: App recovers from most failures automatically

If ANY of these fail, check console logs and follow troubleshooting steps above.
