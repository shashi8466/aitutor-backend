# 🚀 Production Deployment Guide for Welcome Email System

## 📋 Required Actions for Production

### **1. Create Welcome Email Queue Table in Production Supabase**

**You MUST run this SQL in your PRODUCTION Supabase Dashboard:**

```sql
-- Create welcome email queue table for new user welcome emails
CREATE TABLE IF NOT EXISTS welcome_email_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_at TIMESTAMPTZ,
  payload JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_welcome_email_status ON welcome_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_welcome_email_created ON welcome_email_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_welcome_email_user ON welcome_email_queue(user_id);

-- Grant permissions
GRANT ALL ON welcome_email_queue TO postgres, authenticated, anon;

-- Add function to manually add to queue
CREATE OR REPLACE FUNCTION add_to_welcome_queue(user_email TEXT, user_name TEXT, user_id UUID DEFAULT NULL)
RETURNS BIGINT AS $$
DECLARE
  new_id BIGINT;
BEGIN
  INSERT INTO welcome_email_queue (user_id, email, name, status)
  VALUES (user_id, user_email, user_name, 'pending')
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION add_to_welcome_queue TO postgres, authenticated, anon;

-- Verification
SELECT 
  '✅ Welcome Email Queue Table Created' as status,
  COUNT(*) as total_records
FROM welcome_email_queue;
```

### **2. Verify Environment Variables for Production**

**Ensure these environment variables are set in your production deployment:**

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your-production-supabase-url
VITE_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=[REDACTED]

# Email Service (Brevo)
BREVO_API_KEY=[REDACTED]
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Your App Name

# App Configuration
APP_NAME=Your App Name
APP_URL=https://yourdomain.com
```

### **3. Check Production Server Logs**

**After deployment, verify these logs appear:**
```
📧 Welcome email queue processor started
🔔 Notification scheduler initialized
```

### **4. Test Production Welcome Email**

**Steps to test in production:**
1. Create a new test account on your deployed site
2. Check browser console for: "✅ Added to welcome email queue"
3. Verify email is received (check spam folder too)
4. Check `welcome_email_queue` table in Supabase for the entry

## 🔍 Production Troubleshooting

### **Welcome Emails Not Working in Production**

**Check these in order:**

1. **Table Exists?**
   ```sql
   SELECT COUNT(*) FROM welcome_email_queue;
   ```

2. **Environment Variables?**
   - Check your deployment platform's environment variables
   - Ensure `BREVO_API_KEY` is set correctly

3. **Server Logs?**
   - Look for welcome email processing messages
   - Check for any error messages

4. **Queue Processing?**
   ```sql
   SELECT status, COUNT(*) FROM welcome_email_queue GROUP BY status;
   ```

### **Common Production Issues**

**Issue**: Table doesn't exist in production
**Fix**: Run the SQL in your PRODUCTION Supabase dashboard

**Issue**: No environment variables
**Fix**: Add them to your deployment platform (Vercel, Netlify, etc.)

**Issue**: Brevo API not working
**Fix**: Verify API key and email configuration

## 🚀 Deployment Checklist

### **Before Deploy:**
- [ ] Test welcome emails locally
- [ ] Verify all environment variables
- [ ] Check Brevo email service works

### **After Deploy:**
- [ ] Run SQL in production Supabase
- [ ] Test new user signup
- [ ] Verify welcome email received
- [ ] Check server logs for errors

### **Monitor:**
- [ ] Watch `welcome_email_queue` table
- [ ] Monitor email delivery rates
- [ ] Check for processing errors

## 📊 Production Monitoring

**Key Metrics to Monitor:**
1. **Queue Processing**: `SELECT status, COUNT(*) FROM welcome_email_queue GROUP BY status;`
2. **Email Delivery**: Check Brevo dashboard for delivery rates
3. **Server Performance**: Monitor welcome email processor logs

## 🎯 Expected Production Behavior

**Working Correctly:**
- ✅ New users added to queue immediately on signup
- ✅ Emails sent within 10 seconds of signup
- ✅ Queue status changes: pending → processing → sent
- ✅ No signup failures due to email issues

**Error Handling:**
- ⚠️ If email fails, user can still signup
- ⚠️ Failed emails marked as 'failed' status
- ⚠️ Detailed error messages in queue table

## 🔄 Automated Testing

**Create a test script to verify production:**
```bash
# Test signup endpoint
curl -X POST https://yourdomain.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456",
    "name": "Test User",
    "role": "student"
  }'

# Check queue
# (In Supabase SQL Editor)
SELECT * FROM welcome_email_queue WHERE email = 'test@example.com';
```

**Your welcome email system will work perfectly in production once you:**
1. **Run the SQL** in your production Supabase
2. **Set environment variables** for email service
3. **Test with a real signup** on your deployed site
