# Notification System Setup Guide

This guide will help you set up the comprehensive notification and reporting system for your SAT Prep platform.

## Features Included

✅ **Test Completion Notifications** - Automatic emails/SMS/WhatsApp when students complete tests  
✅ **Weekly Progress Reports** - Detailed weekly summaries sent to students and parents  
✅ **Test Due Date Reminders** - Automated reminders for upcoming test deadlines  
✅ **Multi-channel Support** - Email, SMS, and WhatsApp notifications  
✅ **Notification Preferences** - User-controlled notification settings  
✅ **Notification History** - Track all sent notifications and their status  

## Quick Setup

### 1. Install Dependencies

```bash
npm install node-cron twilio
```

### 2. Configure Environment Variables

Copy the notification environment template:
```bash
cp .env.notification.example .env
```

Update your `.env` file with your actual credentials:

```env
# Email Configuration (Gmail/SMTP)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=[REDACTED]
EMAIL_FROM=noreply@yourapp.com

# Twilio Configuration (SMS & WhatsApp)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=[REDACTED]
TWILIO_FROM_NUMBER=+1234567890

# WhatsApp Configuration
WHATSAPP_FROM_NUMBER=+1234567890

# Frontend URL for links in notifications
FRONTEND_URL=http://localhost:5173
```

### 3. Email Setup (Gmail)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for your application
3. Use this app password in `EMAIL_PASS`

### 4. SMS/WhatsApp Setup (Twilio)

1. Sign up for a Twilio account at https://www.twilio.com
2. Get a Twilio phone number with SMS capabilities
3. Enable WhatsApp sandbox for testing:
   - In Twilio Console → Messaging → Try it out → Send a WhatsApp message
   - Follow the instructions to join the sandbox
4. Copy your Account SID and Auth Token to environment variables

### 5. Initialize the Notification System

Add this to your server startup file (`src/server/index.js`):

```javascript
import notificationMiddleware from './middleware/notificationMiddleware.js';

// Initialize notification scheduler
notificationMiddleware.initializeScheduler();
```

### 6. Add Notification Middleware to Routes

For test submission routes:
```javascript
import notificationMiddleware from '../middleware/notificationMiddleware.js';

// Add to your test submission route
router.post('/submit', notificationMiddleware.triggerTestCompletionNotification, async (req, res) => {
  // Your existing test submission logic
});
```

## Detailed Configuration

### Notification Channels

#### Email (Nodemailer)
- Uses Gmail SMTP by default
- Supports HTML templates with responsive design
- Automatic link tracking and delivery status

#### SMS (Twilio)
- 160 character limit per message
- International support
- Delivery receipts and error handling

#### WhatsApp (Twilio WhatsApp API)
- Rich message formatting
- Media attachments support
- Higher engagement rates

### Notification Types

#### 1. Test Completion Notifications
- **Trigger**: Immediately after test submission
- **Recipients**: Student + linked parents
- **Content**: Score, performance analysis, recommendations
- **Channels**: Email, SMS, WhatsApp

#### 2. Weekly Progress Reports
- **Schedule**: Every Sunday at 9:00 AM
- **Recipients**: Students + parents
- **Content**: Tests attempted, scores, progress summary, achievements
- **Channels**: Email, SMS, WhatsApp

#### 3. Test Due Date Reminders
- **Schedule**: Daily at 8:00 AM and 6:00 PM
- **Recipients**: Students + parents
- **Content**: Upcoming tests, due dates, preparation tips
- **Channels**: Email, SMS, WhatsApp

### Notification Templates

All templates are located in `src/server/services/NotificationTemplates.js`:

- **Email Templates**: Responsive HTML with embedded CSS
- **SMS Templates**: Concise text under 160 characters
- **WhatsApp Templates**: Similar to SMS with better formatting

### User Preferences

Users can control:
- **Channels**: Enable/disable email, SMS, WhatsApp
- **Types**: Enable/disable specific notification types
- **Frequency**: Control how often they receive notifications

### Notification History

Track all notifications with:
- **Delivery Status**: Success/failure for each channel
- **Error Messages**: Detailed error information
- **Timestamps**: When notifications were sent
- **Recipients**: Who received each notification

## Testing the System

### 1. Test Email Notifications
```javascript
// Test route
router.post('/test-email', async (req, res) => {
  const notificationService = new NotificationService();
  const result = await notificationService.sendEmail(
    'test@example.com',
    'Test Subject',
    '<h1>Test Email</h1><p>This is a test notification.</p>'
  );
  res.json(result);
});
```

### 2. Test SMS Notifications
```javascript
// Test route
router.post('/test-sms', async (req, res) => {
  const notificationService = new NotificationService();
  const result = await notificationService.sendSMS(
    '+1234567890',
    'Test SMS message from your SAT Prep platform!'
  );
  res.json(result);
});
```

### 3. Test Weekly Reports
```javascript
// Manual trigger for testing
router.post('/test-weekly-report/:studentId', async (req, res) => {
  const scheduler = new NotificationScheduler();
  const result = await scheduler.sendManualWeeklyReport(req.params.studentId);
  res.json(result);
});
```

## Production Considerations

### Rate Limiting
- Implement rate limiting to avoid hitting provider limits
- Use queues for bulk notifications
- Monitor API usage and costs

### Error Handling
- Retry failed notifications with exponential backoff
- Log all errors for debugging
- Provide fallback channels when primary fails

### Security
- Validate all recipient phone numbers and emails
- Use environment variables for sensitive credentials
- Implement CSRF protection for notification preferences

### Performance
- Use background jobs for notification processing
- Cache notification templates
- Batch similar notifications together

## Monitoring and Analytics

### Key Metrics to Track
- **Delivery Rates**: Success rates per channel
- **Open Rates**: Email open and click-through rates
- **Engagement**: How users interact with notifications
- **Errors**: Failed notifications and reasons

### Dashboard Integration
Add notification metrics to your admin dashboard:
- Real-time notification status
- Weekly/monthly statistics
- Error monitoring and alerts

## Troubleshooting

### Common Issues

#### Gmail Authentication Errors
- Ensure 2FA is enabled
- Use App Password, not regular password
- Check Gmail account security settings

#### Twilio Delivery Failures
- Verify phone number format (+countrycode)
- Check Twilio account balance
- Ensure number has SMS/WhatsApp capabilities

#### Missing Notifications
- Check notification preferences
- Verify user contact information
- Check notification logs for errors

### Debug Mode
Enable debug logging by setting:
```env
DEBUG=notifications
```

This will provide detailed logs for all notification activities.

## Cost Optimization

### Email Costs
- Gmail SMTP is free for reasonable volumes
- Consider transactional email services for high volume

### SMS Costs
- Twilio SMS: ~$0.0079 per message (US)
- Implement smart batching to reduce messages
- Use WhatsApp for higher engagement (may be more cost-effective)

### WhatsApp Costs
- Twilio WhatsApp: ~$0.005 per message
- 24-hour conversation window
- Template messages for notifications

## Next Steps

1. **Setup**: Follow the configuration steps above
2. **Test**: Verify each notification channel works
3. **Customize**: Modify templates to match your brand
4. **Monitor**: Set up analytics and monitoring
5. **Scale**: Optimize for production usage

## Support

For issues with:
- **Email**: Check Gmail/SMTP settings
- **SMS/WhatsApp**: Review Twilio configuration
- **Templates**: Modify NotificationTemplates.js
- **Scheduling**: Check NotificationScheduler.js

Happy notifying! 🚀
