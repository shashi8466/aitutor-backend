# 🚨 URGENT FIX: Custom Domain Issues

## **Problems Identified:**

1. ✅ **CORS Error** - Backend already configured for `aiprep365.com` but needs restart
2. ✅ **Missing Function** - Old cached bundle missing `getAllProfiles`
3. ✅ **Deployment Issue** - Firebase serving stale build

---

## 🔧 **Immediate Fixes Required**

### **Fix #1: Restart Backend Server (CRITICAL)**

Your backend at `https://aitutor-backend-u7h3.onrender.com` needs to be restarted to apply CORS changes for `aiprep365.com`.

**Option A: Via Render Dashboard**
1. Go to https://dashboard.render.com/
2. Select your project: `aitutor-backend`
3. Click **"Manual Deploy"** or **"Restart"**
4. Wait 2-3 minutes for restart

**Option B: Trigger via Git Push**
```bash
# Make a small commit to trigger redeploy
git commit --allow-empty -m "Trigger redeploy for CORS fix"
git push origin main
```

**Option C: Use Render CLI**
```bash
render deploy aitutor-backend
```

---

### **Fix #2: Clean Build & Redeploy to Firebase**

The Firebase bundle has cached/stale code missing the `getAllProfiles` function.

#### **Windows:**

```powershell
# 1. Stop any running processes
Ctrl+C in terminal

# 2. Delete old builds
rmdir /s /q dist
rmdir /s /q node_modules\.vite

# 3. Clear npm cache
npm cache clean --force

# 4. Reinstall dependencies (optional but recommended)
npm install

# 5. Fresh build
npm run build

# 6. Deploy to Firebase
firebase deploy --only hosting

# 7. Hard refresh browser
# Ctrl+Shift+R or Cmd+Shift+R
```

#### **Mac/Linux:**

```bash
# 1. Stop any running processes
Ctrl+C in terminal

# 2. Delete old builds
rm -rf dist
rm -rf node_modules/.vite

# 3. Clear npm cache
npm cache clean --force

# 4. Reinstall dependencies (optional but recommended)
npm install

# 5. Fresh build
npm run build

# 6. Deploy to Firebase
firebase deploy --only hosting

# 7. Hard refresh browser
# Ctrl+Shift+R or Cmd+Shift+R
```

---

### **Fix #3: Verify Deployment**

After rebuild and redeploy:

1. **Check Firebase Deploy Log:**
   ```
   ✔  hosting[aitutor-4431c] finished successfully
   ```

2. **Verify on Both Domains:**
   - https://aitutor-4431c.web.app/admin/settings
   - https://aiprep365.com/admin/settings
   
3. **Test Admin Settings Page:**
   - Should load without CORS errors
   - Should show parent management data
   - Console should NOT show `getAllProfiles is not a function`

---

## 📋 **Complete Deployment Checklist**

### **Before Deploying:**

- [ ] Backend server restarted on Render
- [ ] Wait 2-3 minutes after backend restart
- [ ] Test backend health: https://aitutor-backend-u7h3.onrender.com/api/health

### **Build Process:**

- [ ] Deleted old `dist/` folder
- [ ] Cleared Vite cache (`node_modules/.vite`)
- [ ] Ran `npm install` (if needed)
- [ ] Ran `npm run build` successfully
- [ ] No build errors

### **Firebase Deploy:**

- [ ] Ran `firebase deploy --only hosting`
- [ ] Deploy completed successfully
- [ ] Got success message with hosting URL

### **Testing:**

- [ ] Visited https://aiprep365.com/
- [ ] Hard refreshed browser (Ctrl+Shift+R)
- [ ] Logged in as admin
- [ ] Visited /admin/settings
- [ ] No CORS errors in console
- [ ] No `getAllProfiles` errors
- [ ] Parent management loads correctly

---

## 🔍 **How to Verify CORS is Fixed**

In browser console (F12), run:

```javascript
// Test CORS from custom domain
fetch('https://aitutor-backend-u7h3.onrender.com/api/health', {
  mode: 'cors'
})
.then(res => console.log('✅ CORS OK:', res.status))
.catch(err => console.error('❌ CORS Error:', err.message));
```

**Expected Result:**
```
✅ CORS OK: 200
```

---

## 🆘 **If Still Not Working**

### **Issue 1: Backend Still Shows CORS Error**

**Solution:**
1. Confirm backend restart completed
2. Check Render logs for errors
3. Verify CORS configuration in server code:
   ```javascript
   // src/server/index.js lines 49-79
   const allowedOrigins = [
     'https://aiprep365.com',
     'https://www.aiprep365.com',
     // ... others
   ];
   ```

### **Issue 2: Still Getting getAllProfiles Error**

**Solution:**
1. Clear browser cache completely
2. Try incognito/private browsing
3. Check if Firebase deploy actually updated files
4. Verify build output includes the function:
   ```bash
   # After npm run build, check dist/assets/*.js
   grep -i "getAllProfiles" dist/assets/*.js
   ```

### **Issue 3: Site Not Loading at All**

**Solution:**
1. Check Firebase Hosting status
2. Verify DNS still pointing to Firebase
3. Try clearing Service Workers:
   ```javascript
   // In browser console
   navigator.serviceWorker.getRegistrations().then(function(registrations) {
       for(let registration of registrations) {
           registration.unregister();
       }
   });
   ```

---

## ⏱️ **Expected Timeline**

| Step | Time |
|------|------|
| Backend Restart | 2-3 minutes |
| Clean Build | 1-2 minutes |
| Firebase Deploy | 1-2 minutes |
| DNS/Cache Propagation | 5-15 minutes |
| **TOTAL** | **~15-20 minutes** |

---

## ✅ **Success Criteria**

You'll know everything is fixed when:

1. ✅ No CORS errors for `aiprep365.com`
2. ✅ No `getAllProfiles is not a function` errors
3. ✅ Admin settings page loads correctly
4. ✅ Parent management works
5. ✅ All dashboards accessible on custom domain
6. ✅ Same content on both domains

---

## 🎯 **Quick Commands Reference**

### **Backend Restart:**
```bash
# Via Render dashboard
https://dashboard.render.com → Manual Deploy
```

### **Clean Build:**
```bash
rm -rf dist && npm run build
```

### **Deploy:**
```bash
firebase deploy --only hosting
```

### **Test:**
```
https://aiprep365.com/admin/settings
```

---

## 📞 **Next Steps**

1. **Restart backend on Render** (URGENT - fixes CORS)
2. **Run clean build locally** (fixes missing function)
3. **Deploy to Firebase** (updates live site)
4. **Test on custom domain** (verify fixes)

**After these steps, your custom domain will work perfectly! 🚀**
