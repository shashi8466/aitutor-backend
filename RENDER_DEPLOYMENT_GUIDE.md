# 🚨 RENDER DEPLOYMENT GUIDE - Manual Trigger Required

## Current Status

- ✅ Code pushed to GitHub: `57f8f2f feat: Add demo lead submission API endpoint`
- ✅ Backend is running: Health endpoint works (uptime shows it just restarted)
- ❌ Demo endpoint returning 404: Old code is deployed, not the latest commit

## Problem

Render deployed an older version of your code. You need to **manually trigger** a deployment of the latest commit.

---

## 📋 Step-by-Step: Manual Deployment on Render

### Step 1: Go to Render Dashboard

Open this URL in your browser:
```
https://dashboard.render.com
```

### Step 2: Find Your Backend Service

Look for the service named: **`aitutor-backend`**

Click on it to open the service details.

### Step 3: Trigger Manual Deployment

1. **Look for the "Manual Deploy" button**
   - Location: Top right area of the service page
   - It might be a dropdown button

2. **Click "Manual Deploy"**

3. **Select: "Deploy latest commit"**
   - This will deploy commit: `57f8f2f`
   - Message: "feat: Add demo lead submission API endpoint and database migration"

4. **Alternative: If you see "Deploy from master/main"**
   - Click that option
   - It will pull the latest code from GitHub

### Step 4: Monitor the Deployment

After triggering the deployment:

1. **Click on the "Events" tab** (or it might auto-switch)
2. You should see:
   ```
   🔄 Deploying...
   📦 Building...
   🚀 Starting...
   ✅ Deployed successfully
   ```

3. **Click on the deployment** to see live logs

4. **Watch for these log messages** during startup:
   ```
   🚀 Starting Educational Platform Backend Server...
   🚀 SERVER SUCCESSFULLY STARTED
   📡 Port: 10000
   ```

### Step 5: Wait for Completion

- ⏱️ **Build time:** 1-2 minutes
- ⏱️ **Start time:** 30-60 seconds
- ⏱️ **Total:** ~2-3 minutes

The status will change from "In Progress" to "Live" ✅

---

## ✅ Step 6: Verify the Deployment

### Test 1: Health Check

Open this URL in your browser:
```
https://aitutor-backend-u7h3.onrender.com/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "message": "Server is active",
  "timestamp": "2026-04-15T...",
  "uptime": 45.123
}
```

### Test 2: Demo Lead Submission

Run this command in your terminal:
```bash
node test-demo-api.js
```

**Expected output:**
```
🧪 Testing Demo API...

1️⃣ Testing Health Endpoint...
✅ Health Check PASSED: ok
   Server uptime: 45 seconds

2️⃣ Testing Demo Lead Submission...
✅ Lead Submission PASSED: Lead saved and score sent via email
   Response: {
     "success": true,
     "message": "Lead saved and score sent via email"
   }
```

### Test 3: Using cURL (Alternative)

```bash
curl -X POST https://aitutor-backend-u7h3.onrender.com/api/demo/submit-lead \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": 1,
    "fullName": "Test User",
    "grade": "10",
    "email": "test@example.com",
    "phone": "+1234567890",
    "level": "Easy",
    "scoreDetails": {
      "correctCount": 5,
      "totalQuestions": 10,
      "currentLevelPercentage": 50,
      "scaledScore": 1200
    }
  }'
```

**Expected response:**
```json
{
  "success": true,
  "message": "Lead saved and score sent via email"
}
```

---

## 🐛 Troubleshooting

### Issue 1: "Manual Deploy" button not visible

**Solution:**
- Look for a dropdown menu (might be labeled "..." or have an icon)
- Check if you're on the correct service page
- Make sure you're logged in with the right Render account

### Issue 2: Deployment fails

**Check the logs for errors:**
- Click on the failed deployment in the Events tab
- Look for error messages in red
- Common issues:
  - Missing environment variables
  - Build errors (syntax errors, missing dependencies)
  - Port binding issues

**Common fixes:**
```bash
# If build fails due to missing dependencies
npm install

# If there's a syntax error, check the error line in logs
```

### Issue 3: Deployment succeeds but still 404

**Possible causes:**
1. **Cache issue:** Wait 1-2 minutes, then hard refresh
2. **Wrong commit deployed:** Check the Events tab to see which commit was deployed
3. **Routes not mounted:** Check logs for any import errors

**Verify the deployed commit:**
- In Render Events tab, check the commit hash
- It should be: `57f8f2f`
- If it's an older commit, trigger Manual Deploy again

### Issue 4: Getting 500 error instead of 404

**This means:**
- ✅ Backend code is deployed correctly
- ❌ Database migration hasn't been applied

**Solution:**
Apply the database migration in Supabase (see IMMEDIATE_ACTION_STEPS.md, Step 2)

---

## 📊 Deployment Checklist

- [ ] Navigate to Render Dashboard
- [ ] Select aitutor-backend service
- [ ] Click "Manual Deploy" → "Deploy latest commit"
- [ ] Wait for deployment to complete (2-3 minutes)
- [ ] Check Events tab for "Deployed successfully"
- [ ] Test health endpoint: `/api/health`
- [ ] Test demo endpoint: `POST /api/demo/submit-lead`
- [ ] Apply database migration in Supabase (if not done)
- [ ] Test in the actual app frontend

---

## 🎯 After Successful Deployment

Once the endpoint works (returns 200 instead of 404):

1. **Apply the database migration** (if not already done)
   - Go to Supabase Dashboard
   - Run the SQL migration
   - See: `IMMEDIATE_ACTION_STEPS.md` Step 2

2. **Test the complete flow:**
   - Open your app
   - Navigate to a demo course
   - Fill out the lead form
   - Submit and verify you get redirected
   - Check email for score report

3. **Monitor logs on Render:**
   - You should see: `📩 [DEMO] Lead Submission: ...`
   - This confirms the endpoint is being called

---

## 📞 Quick Reference

**Render Dashboard:** https://dashboard.render.com  
**Backend URL:** https://aitutor-backend-u7h3.onrender.com  
**Health Check:** https://aitutor-backend-u7h3.onrender.com/api/health  
**Supabase Dashboard:** https://supabase.com/dashboard  

**Test Script:** `node test-demo-api.js`  
**Migration SQL:** `src/supabase/migrations/1776510000000-add_demo_course_flag.sql`

---

## 💡 Pro Tip

After this manual deployment, Render should auto-deploy on future pushes to main. If it doesn't:

1. Check your Render service settings
2. Make sure "Auto-Deploy" is enabled
3. Verify GitHub webhook is configured

For now, **just trigger the manual deployment** and you'll be good to go! 🚀
