# 🚀 Production Deployment Checklist for Welcome Email System

## ✅ PRE-DEPLOYMENT CHECKLIST

### **1. Database Setup**
- [ ] **Create welcome_email_queue table in PRODUCTION Supabase**
  - Run SQL from `create_welcome_email_queue.sql` in PRODUCTION dashboard
  - Verify table exists: `SELECT COUNT(*) FROM welcome_email_queue;`

### **2. Environment Variables**
- [ ] **Supabase Configuration**
  ```
  VITE_SUPABASE_URL=your-production-supabase-url
  VITE_SUPABASE_ANON_KEY=your-production-anon-key
  SUPABASE_SERVICE_ROLE_KEY=[REDACTED]
  ```

- [ ] **Email Service (Brevo)**
  ```
  BREVO_API_KEY=[REDACTED]
  FROM_EMAIL=noreply@yourdomain.com
  FROM_NAME=Your App Name
  ```

- [ ] **App Configuration**
  ```
  APP_NAME=Your App Name
  APP_URL=https://yourdomain.com
  NODE_ENV=production
  ```

### **3. Email Service Setup**
- [ ] **Brevo Account**: Verified and API key working
- [ ] **Sender Email**: Verified sender domain in Brevo
- [ ] **Templates**: Welcome email template configured

## 🔧 DEPLOYMENT STEPS

### **Step 1: Prepare Production Database**
```sql
-- Run this in PRODUCTION Supabase SQL Editor
-- (Content from create_welcome_email_queue.sql)
```

### **Step 2: Deploy Application**
- Deploy to your platform (Vercel, Netlify, Render, etc.)
- Ensure all environment variables are set
- Wait for deployment to complete

### **Step 3: Verify Production Setup**
- [ ] **Server Logs**: Check for welcome email processor startup
- [ ] **Database**: Verify table creation
- [ ] **Environment**: Confirm variables are loaded

## 🧪 PRODUCTION TESTING

### **Test 1: New User Signup**
1. Go to your deployed site
2. Create a new test account
3. **Expected**: Console shows "✅ Added to welcome email queue"
4. **Expected**: Row appears in `welcome_email_queue` table

### **Test 2: Email Delivery**
1. Check email inbox (including spam folder)
2. **Expected**: Welcome email received within 10 seconds
3. **Expected**: Queue status changes to 'sent'

### **Test 3: Error Handling**
1. Try signup with invalid email
2. **Expected**: User account created, email marked as 'failed'
3. **Expected**: Error message in queue table

## 🔍 PRODUCTION MONITORING

### **Daily Checks**
```sql
-- Check queue status
SELECT status, COUNT(*) FROM welcome_email_queue 
WHERE created_at >= CURRENT_DATE 
GROUP BY status;

-- Check recent failures
SELECT * FROM welcome_email_queue 
WHERE status = 'failed' 
AND created_at >= CURRENT_DATE 
ORDER BY created_at DESC LIMIT 10;
```

### **Server Logs to Monitor**
```
📧 Welcome email queue processor started
📧 Processing X welcome email(s)...
✅ Welcome email sent via Brevo: [email]
❌ Welcome email failed: [error]
```

## 🚨 TROUBLESHOOTING GUIDE

### **Issue: Welcome Emails Not Working**
**Check List:**
1. [ ] Table exists in production: `SELECT COUNT(*) FROM welcome_email_queue;`
2. [ ] Environment variables set correctly
3. [ ] Brevo API key valid
4. [ ] Server logs showing processor startup
5. [ ] New signups appearing in queue table

### **Issue: Queue Not Processing**
**Check List:**
1. [ ] WelcomeEmailProcessor running (check server logs)
2. [ ] Database permissions correct
3. [ ] No server errors in logs
4. [ ] Queue entries have 'pending' status

### **Issue: Emails Not Delivered**
**Check List:**
1. [ ] Brevo API key valid
2. [ ] Sender email verified
3. [ ] Recipient email valid
4. [ ] Check Brevo dashboard for delivery status

## 📊 SUCCESS METRICS

### **What Success Looks Like:**
- ✅ New users added to queue within 1 second of signup
- ✅ Emails sent within 10 seconds of queue addition
- ✅ 95%+ email delivery rate
- ✅ No signup failures due to email issues
- ✅ Proper error handling and logging

### **Monitoring Dashboard:**
```sql
-- Daily summary
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_signups,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as emails_sent,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as emails_failed,
  ROUND(COUNT(CASE WHEN status = 'sent' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
FROM welcome_email_queue 
GROUP BY DATE(created_at) 
ORDER BY date DESC LIMIT 7;
```

## 🔄 MAINTENANCE

### **Weekly Tasks:**
- [ ] Review email delivery rates
- [ ] Check for failed emails and investigate
- [ ] Monitor queue table size
- [ ] Verify Brevo API usage limits

### **Monthly Tasks:**
- [ ] Clean up old queue entries (optional)
- [ ] Review email template performance
- [ ] Update Brevo configuration if needed

## 🎯 FINAL VERIFICATION

**Before going live with marketing:**
1. [ ] Test complete signup flow end-to-end
2. [ ] Verify welcome email content and formatting
3. [ ] Test on different email providers (Gmail, Outlook, etc.)
4. [ ] Check mobile email client rendering
5. [ ] Verify unsubscribe links work (if applicable)

**Your welcome email system is production-ready!** 🎉

Just run the SQL in your production Supabase and ensure environment variables are set.
