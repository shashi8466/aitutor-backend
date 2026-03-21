# 🚀 Complete Deployment Guide
## Educational AI Platform with Automatic Notifications

---

## 📋 Pre-Deployment Checklist

### 1. Environment Variables (.env)
Update these for **PRODUCTION**:

```bash
# Supabase Configuration
SUPABASE_URL=https://wqavuacgbawhgcdxxzom.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SUPABASE_URL=https://wqavuacgbawhgcdxxzom.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# OpenAI API Key
OPENAI_API_KEY=your-openai-key
VITE_OPENAI_API_KEY=your-openai-key

# Email Configuration (Gmail/SMTP)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
EMAIL_FROM=noreply@yourplatform.com

# Twilio Configuration (SMS & WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=YOUR_AUTH_TOKEN_HERE
TWILIO_FROM_NUMBER=+1234567890  # Your actual Twilio number
WHATSAPP_FROM_NUMBER=whatsapp:+14155238886  # Sandbox or production

# Application URLs (PRODUCTION)
APP_URL=https://your-deployed-app.com
FRONTEND_URL=https://your-deployed-app.com
VITE_BACKEND_URL=https://your-backend-api.com
PORT=3001
NODE_ENV=production

# Notification Settings
DEFAULT_NOTIFICATION_CHANNELS=email,sms,whatsapp
NOTIFICATION_RATE_LIMIT=1000
BATCH_NOTIFICATION_SIZE=50

# Optional: Stripe for payments
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

---

## 🗄️ Step 1: Database Setup (Supabase)

Run these SQL scripts in order:

### 1.1 Fix RLS Policies
```sql
-- Run: FIX_ALL_TABLES_RLS.sql
-- This fixes all table permissions and prevents infinite recursion
```

**In Supabase Dashboard:**
1. Go to **SQL Editor**
2. Copy content from `FIX_ALL_TABLES_RLS.sql`
3. Paste and click **Run**
4. Verify success message

### 1.2 Verify Tables Exist
```sql
-- Check all required tables
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

Required tables:
- ✅ courses
- ✅ profiles
- ✅ enrollment_keys
- ✅ enrollments
- ✅ test_submissions
- ✅ questions
- ✅ uploads
- ✅ knowledge_base
- ✅ notification_outbox
- ✅ notification_preferences

### 1.3 Test Database Access
```bash
# From your terminal
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SERVICE_ROLE_KEY');
supabase.from('courses').select('*').then(r => console.log('✅ DB OK:', r.data?.length || 0, 'courses'));
"
```

---

## 🔧 Step 2: Backend Deployment

### Option A: Deploy to Render.com (Recommended)

#### 2.1 Prepare Backend
```bash
# Ensure you have these files:
✅ package.json
✅ src/server/index.js
✅ .env (with production values)
✅ .gitignore
```

#### 2.2 Create Render Web Service
1. Go to https://render.com
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name:** educational-ai-backend
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server/index.js`
   - **Instance Type:** Free or Starter ($7/mo)

#### 2.3 Set Environment Variables in Render
In Render dashboard → Environment:
```
SUPABASE_URL=https://wqavuacgbawhgcdxxzom.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=YOUR_AUTH_TOKEN_HERE
TWILIO_FROM_NUMBER=+1234567890
APP_URL=https://educational-ai-backend.onrender.com
NODE_ENV=production
... (all other vars)
```

#### 2.4 Deploy
```bash
# Git push triggers auto-deploy
git add .
git commit -m "Production ready"
git push origin main
```

Render will automatically build and deploy!

---

### Option B: Deploy to Railway.app

1. Go to https://railway.app
2. Click **New Project** → **Deploy from GitHub**
3. Select your repository
4. Add environment variables
5. Deploy automatically

---

### Option C: Deploy to Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create educational-ai-platform

# Set environment variables
heroku config:set SUPABASE_URL=your-url
heroku config:set TWILIO_ACCOUNT_SID=SCRUBBED_KEY
# ... set all vars

# Deploy
git push heroku main
```

---

## 🌐 Step 3: Frontend Deployment

### Deploy to Vercel (Recommended)

#### 3.1 Update vite.config.js
```javascript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    port: 5173
  },
  // Production API URL
  define: {
    'import.meta.env.VITE_BACKEND_URL': JSON.stringify(process.env.VITE_BACKEND_URL || 'https://your-backend.onrender.com')
  }
});
```

#### 3.2 Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

Or use GitHub integration:
1. Go to https://vercel.com
2. Import your GitHub repository
3. Set build settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Click **Deploy**

#### 3.3 Set Environment Variables in Vercel
In Vercel dashboard → Settings → Environment Variables:
```
VITE_SUPABASE_URL=https://wqavuacgbawhgcdxxzom.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_OPENAI_API_KEY=your-openai-key
VITE_BACKEND_URL=https://your-backend.onrender.com
```

---

## 📱 Step 4: Twilio Configuration

### 4.1 Upgrade from Sandbox (Production)

If going to production (not sandbox):

1. Go to https://console.twilio.com
2. Buy a phone number
3. Configure webhook:
   ```
   https://your-backend.onrender.com/api/sms/webhook
   ```
4. Enable WhatsApp (if needed):
   - Apply for WhatsApp Business API
   - Wait for approval (2-3 days)

### 4.2 Test SMS Delivery
```bash
curl -X POST https://your-backend.onrender.com/api/notifications/test-sms \
  -H "Content-Type: application/json" \
  -d '{"to": "+918466924574", "message": "Test from Educational Platform"}'
```

---

## 🧪 Step 5: Post-Deployment Testing

### 5.1 Quick Health Check
```bash
# Check backend is running
curl https://your-backend.onrender.com/health

# Expected: {"status":"ok","timestamp":"2025-01-22T..."}
```

### 5.2 Test Notification Templates
```bash
# Run template test
node test-simple-notification-templates.cjs

# Expected: All templates generate successfully ✅
```

### 5.3 Test Full Workflow

#### Scenario 1: Test Completion Notification

1. **Login as Student**
   ```
   https://your-app.vercel.app/login
   ```

2. **Complete a Test**
   - Navigate to Courses
   - Start any test
   - Answer questions
   - Submit

3. **Wait 1-2 Minutes**

4. **Check Inboxes**
   - ✅ Student email: Score report
   - ✅ Student SMS: Score summary
   - ✅ Parent email: Child's results
   - ✅ Parent SMS: Notification

#### Scenario 2: Weekly Progress Report

**Manual Trigger (for testing):**
```bash
curl -X POST https://your-backend.onrender.com/api/admin/send-weekly-report \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "STUDENT_UUID", "forceSend": true}'
```

**Expected:** Both student and parent receive weekly report via email/SMS

---

## 🔍 Step 6: Monitoring & Debugging

### Check Backend Logs

**On Render:**
```bash
# Via Render Dashboard
Dashboard → Logs → View Real-time Logs
```

Look for:
```
✅ [Notification] Test completion triggered
✅ [Outbox] Processing notifications
✅ [Email] Sent test completion email
✅ [SMS] Sent test completion SMS
```

### Check Database

```sql
-- Recent notifications
SELECT event_type, status, created_at, processed_at
FROM notification_outbox
ORDER BY created_at DESC
LIMIT 20;

-- Failed notifications
SELECT COUNT(*) FROM notification_outbox WHERE status = 'failed';

-- Pending queue
SELECT COUNT(*) FROM notification_outbox WHERE status = 'pending';
```

### Check Twilio Logs

1. Go to https://console.twilio.com
2. Messaging → Logs → Message Log
3. Filter by date/status
4. Verify messages are "delivered"

---

## ⚠️ Common Issues & Fixes

### Issue 1: Backend Won't Start
```bash
# Check logs on Render
Error: Missing environment variable XYZ

# Fix: Add missing env var in Render dashboard
```

### Issue 2: CORS Errors
```javascript
// In src/server/index.js
app.use(cors({
  origin: ['https://your-app.vercel.app', 'http://localhost:5173'],
  credentials: true
}));
```

### Issue 3: Notifications Not Sending
```bash
# Check if cron scheduler started
grep "Notification scheduler" backend.log

# Manually process outbox
node src/server/scripts/process-outbox.js

# Restart backend (Render auto-restarts on git push)
```

### Issue 4: Database Permissions Error
```sql
-- Re-run RLS fix
-- Run: FIX_ALL_TABLES_RLS.sql in Supabase SQL Editor
```

### Issue 5: Email Goes to Spam
```bash
# Update SPF/DKIM records for your domain
# Use professional email (not Gmail) for production
EMAIL_FROM=noreply@yourplatform.com
```

---

## 📊 Deployment Verification Checklist

After deployment, verify:

### Backend:
- [ ] Health endpoint returns 200 OK
- [ ] All API routes accessible
- [ ] Database connection works
- [ ] Notification scheduler started
- [ ] No errors in logs

### Frontend:
- [ ] Homepage loads
- [ ] Login works
- [ ] Student dashboard shows courses
- [ ] Can complete tests
- [ ] No console errors

### Notifications:
- [ ] Test completion emails sent
- [ ] SMS messages delivered
- [ ] WhatsApp messages work
- [ ] Weekly reports scheduled
- [ ] Parent notifications working

### Database:
- [ ] All tables accessible
- [ ] RLS policies correct
- [ ] No permission errors
- [ ] Data persists correctly

---

## 🎯 Production URLs

After deployment, update these in `.env`:

```bash
# Local Development
APP_URL=http://localhost:5173
VITE_BACKEND_URL=http://localhost:3001

# Production (UPDATE THESE!)
APP_URL=https://educational-ai.vercel.app
VITE_BACKEND_URL=https://educational-ai-backend.onrender.com
```

---

## 📞 Support Resources

### Documentation:
- [POST_DEPLOYMENT_TESTING_GUIDE.md](./POST_DEPLOYMENT_TESTING_GUIDE.md)
- [AUTOMATIC_NOTIFICATION_COMPLETE_GUIDE.md](./AUTOMATIC_NOTIFICATION_COMPLETE_GUIDE.md)
- [TWILIO_CONFIGURATION.md](./TWILIO_CONFIGURATION.md)

### Diagnostic Scripts:
- `test-simple-notification-templates.cjs` - Template validation
- `check-backend.js` - Backend health check
- `VERIFY_SUPABASE.js` - Database connectivity

### Monitoring Tools:
- Render Dashboard → Logs
- Vercel Analytics → Performance
- Supabase Logs → Database queries
- Twilio Console → Message delivery

---

## 🎉 Deployment Complete!

Once deployed, your system will automatically:

| Event | Action | Timing |
|-------|--------|--------|
| Student completes test | Sends score report to student + parents | 1-2 min |
| Every Monday 9 AM | Sends weekly progress report | Weekly |
| Test due tomorrow | Sends reminder | 24h before |
| Course completed | Sends certificate info | Instant |

**Estimated Deployment Time:** 30-45 minutes  
**Success Criteria:** All tests pass ✅  
**Cost:** Free tier (Render + Vercel + Supabase)  

---

**Ready to deploy!** 🚀

Follow the steps above and your educational platform will be live with full automatic notification capabilities!
