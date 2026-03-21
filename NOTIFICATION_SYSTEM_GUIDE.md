# Notification & Reporting System - Complete Guide

## Overview

The Educational Platform now includes a comprehensive notification and reporting system that keeps students, parents, and tutors informed about test results, progress, and upcoming deadlines through multiple channels: **Email**, **SMS**, and **WhatsApp**.

---

## Features Implemented

### ✅ 1. Test Completion Notifications
**Triggered automatically** when a student submits a test:
- **Student receives**: Email/SMS/WhatsApp with test score and performance summary
- **Parent receives**: Same notification if linked to the student
- **Delivery time**: Within 1-2 minutes of submission

**Example Email:**
```
Subject: Test Completed: SAT Math Prep (Medium)

Hello John,

Your test for SAT Math Prep has been graded:
- Percentage: 85%
- Scaled Score: 680
- Correct: 19/22 questions
- Grade: Excellent

Review your incorrect answers to improve!
[View Full Report →]
```

### ✅ 2. Weekly Progress Reports
**Sent every Monday at 9 AM** (configurable):
- **Tests taken** in the past week
- **Average score** and **best score**
- **Complete test history** with dates and levels
- Sent to both **student** and **linked parents**

**Example Email:**
```
Subject: Weekly Progress Report

Hello John,

Here is your weekly performance summary:
- Tests Taken: 5
- Avg Score: 78%
- Best Score: 92%

Test History This Week:
Date       | Course      | Level  | Score | Scaled
Jan 20     | SAT Math    | Medium | 85%   | 680
Jan 19     | SAT English | Hard   | 78%   | 620
...
```

### ✅ 3. Test Due Date Reminders
**Sent daily at 8 AM and 6 PM** for tests due within 72 hours:
- Lists all **upcoming test deadlines**
- Shows **time remaining** (e.g., "2 days left")
- Color-coded by urgency (green → yellow → red)
- Sent to student and parents

**Example SMS:**
```
AI Tutor: Upcoming test due dates. 
Next: SAT Math – Medium due 01/25/2026.
```

---

## Architecture

### System Flow

```
Student submits test
    ↓
grading.js route handler
    ↓
notificationMiddleware intercepts
    ↓
scheduler.triggerTestCompletionNotification()
    ↓
Fetches data & builds payload
    ↓
enqueueNotification() → notification_outbox table
    ↓
Outbox processor (runs every minute)
    ↓
Gets user preferences & contact info
    ↓
Sends via email/sms/whatsapp
    ↓
Updates status to 'sent'
```

### Database Tables

#### 1. `notification_outbox`
Queue for pending notifications:
- `event_type`: Type of notification
- `recipient_profile_id`: Who receives it
- `channels`: ['email', 'sms', 'whatsapp']
- `payload`: JSON data for building message
- `status`: pending → processing → sent/failed

#### 2. `notification_preferences`
User customization settings:
- Enable/disable specific event types
- Choose preferred channels (email/sms/whatsapp)
- Quiet hours configuration
- Custom phone/email overrides

#### 3. `test_assignments`
Tracks assigned tests with due dates:
- `user_id`: Student assigned to
- `course_id`, `level`: Which test
- `due_at`: Deadline
- `status`: assigned/completed/overdue

---

## Configuration

### Step 1: Set Up Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Email (Gmail example)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password  # NOT regular password!
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465

# Get Gmail App Password:
# 1. Go to Google Account Settings
# 2. Security → 2-Step Verification
# 3. App Passwords → Generate for Mail
# 4. Copy the 16-character password

# Twilio SMS
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=+1234567890

# Get Twilio credentials:
# 1. Sign up at https://twilio.com
# 2. Console Dashboard → Account SID & Auth Token
# 3. Phone Numbers → Buy a number

# Twilio WhatsApp (Sandbox mode for testing)
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Enable WhatsApp sandbox:
# 1. Go to Twilio Console → WhatsApp Sandbox
# 2. Follow instructions to join via WhatsApp
# 3. Use the sandbox number provided

# Application Settings
APP_NAME=AI Tutor Platform
APP_URL=http://localhost:5173
CRON_SECRET=generate-random-secret
# Generate with: openssl rand -hex 32
```

### Step 2: Run Database Migration

Execute the migration to create notification tables:

```bash
# Option 1: Via Supabase Dashboard
# 1. Go to SQL Editor
# 2. Copy contents of migrations/add_notification_tables.sql
# 3. Run the SQL

# Option 2: Via Supabase CLI
npx supabase db push migrations/add_notification_tables.sql
```

**Tables created:**
- ✅ `notification_outbox`
- ✅ `notification_preferences`
- ✅ `test_assignments`
- ✅ RLS policies for security
- ✅ Indexes for performance

### Step 3: Start the Backend Server

```bash
npm run dev
# or
npm start
```

You should see:
```
🔔 Notification scheduler initialized successfully
```

---

## Testing

### Manual Trigger Endpoints

For testing purposes, use these endpoints (require `CRON_SECRET`):

#### 1. Test Completion Notification

```bash
curl -X POST http://localhost:3001/api/notifications/test-completion-manual \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: your-cron-secret" \
  -d '{
    "submissionId": 123,
    "studentId": "uuid-here"
  }'
```

**Response:**
```json
{
  "ok": true,
  "message": "Test completion notification triggered successfully",
  "submissionId": 123,
  "studentId": "uuid-here"
}
```

#### 2. Weekly Report

```bash
curl -X POST http://localhost:3001/api/notifications/weekly-manual \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: your-cron-secret" \
  -d '{
    "studentId": "uuid-here"
  }'
```

**Response:**
```json
{
  "ok": true,
  "message": "Weekly report sent successfully",
  "totalTests": 5,
  "avgScore": 78,
  "bestScore": 92
}
```

#### 3. Due Date Reminder

```bash
curl -X POST http://localhost:3001/api/notifications/due-reminder-manual \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: your-cron-secret" \
  -d '{
    "studentId": "uuid-here"
  }'
```

**Response:**
```json
{
  "ok": true,
  "message": "Due date reminder sent successfully",
  "assignmentCount": 3
}
```

### Testing Checklist

- [ ] **Email Delivery**: Check inbox/spam folder
- [ ] **SMS Delivery**: Check phone received text
- [ ] **WhatsApp Delivery**: Check WhatsApp message
- [ ] **Preferences Respected**: Disabled channels don't send
- [ ] **Parent Notifications**: Linked parents receive copies
- [ ] **Cron Jobs Running**: Check server logs for scheduled tasks
- [ ] **Outbox Processing**: Verify pending → sent status changes

---

## User Preferences

Users can customize their notification settings via API or UI:

### Get Preferences

```bash
GET /api/notifications/preferences/:userId
```

### Update Preferences

```bash
PATCH /api/notifications/preferences/:userId
Content-Type: application/json

{
  "test_completed_enabled": true,
  "weekly_report_enabled": true,
  "due_date_enabled": true,
  "email_enabled": true,
  "sms_enabled": false,
  "whatsapp_enabled": true,
  "phone_e164": "+1234567890",
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00"
}
```

### Default Behavior

If no preferences set:
- **All event types enabled**
- **Email enabled**, SMS/WhatsApp disabled
- Uses email/phone from profile
- No quiet hours (24/7 delivery)

---

## Scheduled Jobs

### Outbox Processor
**Schedule:** Every minute (`* * * * *`)

Processes pending notifications from the queue:
1. Fetches items where `scheduled_for <= now()`
2. Claims item (status: pending → processing)
3. Builds content based on event type
4. Sends via enabled channels
5. Updates status (sent/failed)

### Weekly Reports
**Schedule:** Every Sunday at 9 AM (`0 9 * * 0`)

Generates reports for all students:
1. Fetches last 7 days of submissions
2. Calculates statistics
3. Enqueues notifications for students and parents
4. Processes outbox immediately

### Due Date Reminders
**Schedule:** Daily at 8 AM and 6 PM (`0 8 * * *`, `0 18 * * *`)

Sends deadline reminders:
1. Finds tests due in next 72 hours
2. Groups by student
3. Enqueues notifications
4. Processes outbox immediately

**Timezone:** America/New_York (configurable in code)

---

## Troubleshooting

### Issue: Emails Not Sending

**Symptoms:** Logs show "❌ [Email] Failed to send"

**Solutions:**
1. Verify SMTP credentials in `.env`
2. Check Gmail App Password (not regular password)
3. Ensure "Less secure app access" is enabled (for older Gmail accounts)
4. Try alternative provider (SendGrid, Outlook)
5. Check firewall allows outbound connections on port 465/587

### Issue: SMS/WhatsApp Not Working

**Symptoms:** Logs show "❌ [Twilio] Error 401"

**Solutions:**
1. Verify TWILIO_ACCOUNT_SID and AUTH_TOKEN
2. Ensure phone numbers are in E.164 format (+1234567890)
3. For WhatsApp, confirm sandbox activation
4. Check Twilio account balance/credits
5. Verify phone number is whitelisted in sandbox

### Issue: Notifications Not Triggering

**Symptoms:** Test submitted but no notification received

**Solutions:**
1. Check `notification_outbox` table for queued items
2. Verify cron scheduler is running (check startup logs)
3. Ensure CRON_SECRET is set and matches in requests
4. Check user preferences - notifications might be disabled
5. Verify middleware is attached to grading routes

### Issue: Duplicate Notifications

**Symptoms:** Receiving same notification multiple times

**Solutions:**
1. Check for duplicate entries in notification_outbox
2. Verify cron jobs not running multiple instances
3. Ensure database constraints prevent duplicates
4. Add unique index on outbox table

### Issue: Parent Not Receiving Notifications

**Symptoms:** Student gets notification, parent doesn't

**Solutions:**
1. Verify parent-child link in `profiles.linked_students`
2. Check parent's notification preferences
3. Ensure parent has valid email/phone in profile
4. Look for errors in parent notification enqueue process

---

## Performance Optimization

### Indexes Added

```sql
-- Fast lookup of pending notifications
idx_notification_outbox_status(status, scheduled_for)

-- Quick filtering by recipient
idx_notification_outbox_recipient(recipient_profile_id, status)

-- Efficient event type queries
idx_notification_outbox_event_type(event_type, status)
```

### Retry Logic

- **Max attempts:** 3 per notification
- **Backoff:** Exponential (1min, 5min, 15min)
- **Failure handling:** Mark as failed after 3 attempts
- **Dead letter:** Failed notifications retained for debugging

### Batch Processing

- **Default batch size:** 25 notifications per run
- **Configurable:** Via `limit` parameter
- **Parallel sends:** Email/SMS/WhatsApp sent concurrently
- **Rate limiting:** Built-in delays to avoid API throttling

---

## Security

### Row Level Security (RLS)

All notification tables have RLS enabled:

- **Students/Parents:** Can only view own notifications
- **Admins:** Can view all for debugging
- **System:** Bypasses RLS for automated sending

### Cron Secret Protection

All manual trigger endpoints require `x-cron-secret` header:

```javascript
headers: { 'x-cron-secret': process.env.CRON_SECRET }
```

Prevents unauthorized users from triggering mass notifications.

### Data Retention

- **Sent notifications:** Kept indefinitely (audit trail)
- **Failed notifications:** Retained for 30 days
- **Auto-cleanup:** Scheduled job removes old records monthly

---

## Extending the System

### Adding New Event Types

1. **Define event type constant:**
```javascript
const EVENT_TYPES = {
  TEST_COMPLETED: 'TEST_COMPLETED',
  ACHIEVEMENT_UNLOCKED: 'ACHIEVEMENT_UNLOCKED' // New!
};
```

2. **Add email template builder:**
```javascript
export function buildAchievementEmail({ ... }) {
  // Return subject, html, smsMessage
}
```

3. **Update content builder:**
```javascript
if (eventType === 'ACHIEVEMENT_UNLOCKED') {
  return buildAchievementEmail(payload);
}
```

4. **Add preference toggle:**
```sql
ALTER TABLE notification_preferences 
ADD COLUMN achievement_enabled boolean DEFAULT true;
```

5. **Create trigger/enqueue logic**

### Adding New Channels

1. **Implement sender function:**
```javascript
export async function sendPushNotification({ userId, title, body }) {
  // Send via Firebase Cloud Messaging, OneSignal, etc.
}
```

2. **Update sendNotification():**
```javascript
if (enabledChannels.includes('push')) {
  tasks.push(sendPushNotification(...));
}
```

3. **Add channel preference:**
```sql
ALTER TABLE notification_preferences 
ADD COLUMN push_enabled boolean DEFAULT false;
```

---

## Monitoring & Analytics

### Key Metrics to Track

1. **Delivery Rate:** `(sent / total) * 100`
2. **Average Delivery Time:** Time from enqueue to sent
3. **Channel Performance:** Email vs SMS vs WhatsApp success rates
4. **User Engagement:** Open rates, click-through rates
5. **Error Patterns:** Common failure reasons

### Query Examples

**Pending notifications count:**
```sql
SELECT COUNT(*) FROM notification_outbox 
WHERE status = 'pending' AND scheduled_for <= now();
```

**Delivery success rate by channel:**
```sql
SELECT 
  unnest(channels) as channel,
  COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
  COUNT(*) as total_count,
  ROUND(COUNT(*) FILTER (WHERE status = 'sent') * 100.0 / COUNT(*), 2) as success_rate
FROM notification_outbox
GROUP BY unnest(channels);
```

**Most active notification types:**
```sql
SELECT 
  event_type,
  COUNT(*) as total_sent,
  AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_delivery_seconds
FROM notification_outbox
WHERE status = 'sent'
GROUP BY event_type
ORDER BY total_sent DESC;
```

---

## Cost Estimates

### Email (Gmail/SMTP)
- **Free** up to 500 emails/day (Gmail)
- **Free** unlimited (SendGrid free tier: 100/day)

### Twilio SMS
- **Cost:** ~$0.0075 per message (US numbers)
- **Example:** 100 students × 2 tests/week × 4 weeks = 800 SMS/month ≈ $6

### Twilio WhatsApp
- **Cost:** First 1,000 conversations/month FREE
- **After:** ~$0.005 per message
- **Example:** 100 students × 2 tests/week = 800/month ≈ $4

**Total Monthly Cost (100 students):** ~$10-15

---

## Support

For issues or questions:
1. Check this guide first
2. Review server logs for error messages
3. Inspect `notification_outbox` table for stuck items
4. Verify environment variables are correctly set
5. Contact development team with error details

---

## Changelog

### v1.0.0 (Initial Release)
- ✅ Test completion notifications
- ✅ Weekly progress reports
- ✅ Due date reminders
- ✅ Email, SMS, WhatsApp support
- ✅ User preferences system
- ✅ Manual trigger endpoints
- ✅ Automated scheduling

### Planned Features
- Push notifications (mobile app)
- In-app notification center
- Notification analytics dashboard
- A/B testing for message templates
- Multi-language support
