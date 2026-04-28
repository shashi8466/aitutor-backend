# Email Sending Troubleshooting Guide

## Problem
After submitting the Full-Length Adaptive SAT Test demo form, no emails are received by either the student or admin.

## Quick Diagnostic Steps

### 1. Check Server Logs in Render Dashboard

The enhanced logging will now show detailed information. Look for these sections in your Render logs:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 ENVIRONMENT VALIDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SUPABASE_URL: https://...
✅ SUPABASE_SERVICE_ROLE_KEY: xkeysib-...
✅ BREVO_API_KEY: xkeysib-51...
✅ EMAIL_FROM: ssky57771@gmail.com

✅ All critical environment variables are present
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If any show ❌ MISSING, you need to set them in Render dashboard.

### 2. Use the Diagnostic Endpoints

Access these URLs in your browser (replace with your actual Render URL):

**Check Environment Configuration:**
```
https://your-render-url.onrender.com/api/demo/diag
```

This will show:
- BREVO_API_KEY status
- EMAIL_FROM configuration
- ADMIN_EMAIL configuration
- Supabase connection status

**Send a Test Email:**
```
https://your-render-url.onrender.com/api/demo/test-email?to=your-email@gmail.com
```

This will attempt to send a test email and return detailed results.

### 3. Common Issues & Solutions

#### Issue #1: Sender Email Not Verified in Brevo (Most Common)

**Error Message:**
```
❌ [BREVO API ERROR]
   Status: 400
   Error: ... sender ...
   Hint: Sender email 'ssky57771@gmail.com' is not verified in Brevo.
```

**Solution:**
1. Log in to [Brevo Dashboard](https://app.brevo.com/)
2. Go to **Senders & IP** > **Senders**
3. Click **Add a sender**
4. Add `ssky57771@gmail.com` (or your EMAIL_FROM address)
5. Check your email and click the verification link
6. Wait 5-10 minutes for verification to propagate

#### Issue #2: Invalid or Expired API Key

**Error Message:**
```
❌ [BREVO API ERROR]
   Status: 401
   Error: Invalid API key
   Hint: Invalid API key. Check BREVO_API_KEY environment variable.
```

**Solution:**
1. Go to [Brevo API Keys](https://app.brevo.com/settings/keys/api)
2. Create a new API key (SMTP type)
3. Copy the key
4. In Render Dashboard > Your Service > Environment
5. Update `BREVO_API_KEY` with the new key
6. Redeploy the service

#### Issue #3: Missing Environment Variables

**Server Log Shows:**
```
❌ BREVO_API_KEY: MISSING
❌ EMAIL_FROM: MISSING
```

**Solution:**
1. Go to Render Dashboard
2. Click on your backend service
3. Go to **Environment** tab
4. Add these variables:
   ```
   BREVO_API_KEY=xkeysib-your-actual-key-here
   EMAIL_FROM=ssky57771@gmail.com
   ADMIN_EMAIL=ssky57771@gmail.com
   APP_NAME=AIPrep365
   ```
5. Click **Save Changes**
6. Service will auto-redeploy

#### Issue #4: Brevo Free Plan Limits

**Symptoms:**
- Emails worked initially but stopped
- Error mentions quota or limits

**Solution:**
1. Check your Brevo account at [Brevo Dashboard](https://app.brevo.com/)
2. Free plan allows 300 emails/day
3. If you've exceeded this, either:
   - Wait for daily reset
   - Upgrade to paid plan
   - Reduce test email frequency

## Testing After Fix

### Step 1: Verify Environment
Visit: `https://your-render-url.onrender.com/api/demo/diag`

Expected response:
```json
{
  "status": "ok",
  "env": {
    "BREVO_API_KEY": "SET (starts with xkeysib...)",
    "EMAIL_FROM": "ssky57771@gmail.com",
    "ADMIN_EMAIL": "ssky57771@gmail.com",
    "SUPABASE_URL": "SET",
    "SUPABASE_SERVICE_ROLE_KEY": "SET"
  }
}
```

### Step 2: Send Test Email
Visit: `https://your-render-url.onrender.com/api/demo/test-email?to=your-email@gmail.com`

Expected response:
```json
{
  "success": true,
  "message": "Test email sent successfully to your-email@gmail.com",
  "messageId": "<message-id>"
}
```

### Step 3: Test Demo Form
1. Go to your website
2. Navigate to Full-Length Adaptive SAT Test demo
3. Complete the test
4. Submit the lead form
5. Check server logs for:
   ```
   ============================================================
   📧 [EMAIL SENDING DETAILS]
   ============================================================
      To: ssky57771@gmail.com
      Subject: NEW DEMO LEAD: ...
   ```

6. Look for success confirmation:
   ```
   ============================================================
   ✅ [EMAIL SENT SUCCESSFULLY]
      To: ssky57771@gmail.com
      Message ID: <...>
   ============================================================
   ```

## Server Log Keywords to Search

When checking Render logs, search for these keywords:

- `ENVIRONMENT VALIDATION` - Shows startup env var status
- `EMAIL SENDING DETAILS` - Shows email attempt details
- `EMAIL SENT SUCCESSFULLY` - Confirms email was sent
- `BREVO API ERROR` - Shows what went wrong
- `DEMO] Step` - Shows lead submission progress

## Email Flow Summary

When a demo form is submitted:

1. ✅ Lead saved to database (`demo_leads` table)
2. ✅ Admin email sent to `ADMIN_EMAIL` with lead details
3. ✅ Student email sent to form email with score report

Both emails are sent **independently**, so one can fail while the other succeeds.

## Need More Help?

If emails still aren't working after following this guide:

1. Copy the full error from Render logs
2. Check the `/api/demo/diag` endpoint output
3. Verify sender email is verified in Brevo dashboard
4. Ensure API key has SMTP permissions
5. Check Brevo account for any suspension or limit issues

## Environment Variables Required

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `BREVO_API_KEY` | ✅ Yes | `xkeysib-510b...` | Brevo API authentication |
| `EMAIL_FROM` | ✅ Yes | `ssky57771@gmail.com` | Sender email (must be verified in Brevo) |
| `ADMIN_EMAIL` | ✅ Yes | `ssky57771@gmail.com` | Receives lead notifications |
| `APP_NAME` | Optional | `AIPrep365` | App name in email headers |
| `SUPABASE_URL` | ✅ Yes | `https://xxx.supabase.co` | Database connection |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | `eyJ...` | Admin database access |
