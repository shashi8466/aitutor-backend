# Email Setup Guide for Full-Length Adaptive SAT Test Demo

## 🔧 Quick Fix for Email Issues

If you're not receiving emails after form submission, follow these steps:

### 1. Environment Variables Setup

Create or update your `.env` file with these variables:

```bash
# Brevo Email Configuration (REQUIRED)
BREVO_API_KEY=your_brevo_api_key_here
EMAIL_FROM=your_verified_sender_email@example.com
EMAIL_USER=your_verified_sender_email@example.com

# Application Configuration
APP_NAME=AIPrep365
ADMIN_EMAIL=admin@example.com
FRONTEND_URL=https://your-domain.com

# Database Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Get Brevo API Key

1. Sign up/login to [Brevo Dashboard](https://app.brevo.com/)
2. Go to Account → SMTP & API
3. Generate a new API key v3
4. Copy the API key and add to your `.env` file

### 3. Verify Sender Email

1. In Brevo dashboard, go to Senders
2. Add and verify your sender email address
3. The sender email must match `EMAIL_FROM` in your `.env`
4. Verification may take 24-48 hours

### 4. Test Email Configuration

Run the email test script:

```bash
node test-email-sending.js
```

### 5. Check Server Logs

After form submission, check server logs for these messages:

```
📧 [DEMO] Preparing to send emails...
🔧 [DEMO] Email Configuration Debug:
   BREVO_API_KEY: SET
   EMAIL_FROM: your_email@example.com
   ADMIN_EMAIL: admin@example.com
   STUDENT_EMAIL: student@example.com
📨 [DEMO] Building admin email...
📤 [DEMO] Sending admin email...
✅ [DEMO] Admin email sent successfully to admin@example.com
📨 [DEMO] Building student email...
📤 [DEMO] Sending student email...
✅ [DEMO] User email sent successfully to student@example.com
```

## 🚨 Common Issues & Solutions

### Issue: "BREVO_API_KEY not configured"
**Solution**: Add the API key to your `.env` file and restart the server

### Issue: "Sender email not verified"
**Solution**: Verify your sender email in Brevo dashboard (may take 24-48 hours)

### Issue: "Network connectivity issues"
**Solution**: Check if your server can reach `api.brevo.com`

### Issue: "Invalid recipient email"
**Solution**: Ensure the email addresses are valid and properly formatted

### Issue: "Rate limiting exceeded"
**Solution**: Check your Brevo account quota and limits

## 🔍 Debugging Steps

1. **Check Environment Variables**:
   ```bash
   echo $BREVO_API_KEY
   echo $EMAIL_FROM
   echo $ADMIN_EMAIL
   ```

2. **Test API Connection**:
   ```bash
   curl -X POST https://api.brevo.com/v3/smtp/email \
   -H "api-key: YOUR_API_KEY" \
   -H "Content-Type: application/json" \
   -d '{"sender":{"email":"test@example.com"},"to":[{"email":"test@example.com"}],"subject":"Test","htmlContent":"<p>Test</p>"}'
   ```

3. **Run Diagnostic Script**:
   ```bash
   node diagnose-email-issues.js
   ```

4. **Check Server Logs**:
   Look for detailed error messages in your server console

## 📧 Expected Email Flow

After successful form submission:

1. **Admin Email**: Sent to `ADMIN_EMAIL` with lead details and test scores
2. **Student Email**: Sent to student's email with final predicted score

Both emails should arrive within 1-2 minutes of form submission.

## 🛠️ Advanced Configuration

### Custom Email Templates

Email templates are located in:
- `src/server/utils/notificationEngine.js`
- `buildDemoAdminEmail()` - Admin notification template
- `buildDemoScoreEmail()` - Student score report template

### Email Testing

Use the test script to verify configuration:
```bash
node test-email-sending.js
```

### Production Deployment

For production, ensure:
1. Environment variables are set in your hosting platform
2. Brevo account has sufficient sending quota
3. Sender emails are verified
4. DNS records are properly configured

## 🆘 Support

If emails still don't work after following this guide:

1. Check server logs for detailed error messages
2. Verify Brevo API key is active and has correct permissions
3. Ensure sender email is verified in Brevo dashboard
4. Test with different recipient email addresses
5. Check network connectivity and firewall settings

The enhanced logging will show exactly where the email sending process is failing.
