# 🧪 Post-Deployment Testing Guide
## Automatic Score Reports & Notifications

This guide helps you verify that **all automatic notifications** work correctly after deploying your application.

---

## ✅ Pre-Deployment Checklist

Before testing, ensure these are configured:

### 1. Environment Variables (.env)
```bash
# Email Configuration (REQUIRED)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=[REDACTED]
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465

# Twilio Configuration (REQUIRED for SMS/WhatsApp)
TWILIO_ACCOUNT_SID=[REDACTED]
TWILIO_AUTH_TOKEN=[REDACTED]
TWILIO_FROM_NUMBER=+1234567890  # Your Twilio number
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886  # Sandbox

# Application URLs
APP_URL=https://your-deployed-app.com
VITE_BACKEND_URL=https://your-backend-url.com
FRONTEND_URL=https://your-deployed-app.com

# Notification Settings
DEFAULT_NOTIFICATION_CHANNELS=email,sms,whatsapp
NOTIFICATION_RATE_LIMIT=1000
BATCH_NOTIFICATION_SIZE=50
```

### 2. Database Setup
Run these SQL scripts in Supabase:
- `FIX_ALL_TABLES_RLS.sql` - Fix RLS policies
- Ensure `notification_outbox` table exists
- Ensure `notification_preferences` table exists

### 3. Backend Deployment
- Backend server running without errors
- Check logs for notification service startup messages
- Verify cron scheduler is running

---

## 🎯 Test Scenario 1: Test Completion Notification

**What it tests:** When a student completes a test, both student and parents receive score reports.

### Setup:
1. Login as **Student** (e.g., Shashi)
2. Navigate to `/student/courses`
3. Select any course with tests
4. Start a test

### Action:
1. Complete the test (answer all questions)
2. Submit the test
3. Wait 1-2 minutes

### Expected Results:

#### Student Receives:
✅ **Email** with:
- Subject: "Test Completed: [Course Name]"
- Score percentage
- Scaled score
- Correct/incorrect answers breakdown
- Link to review test

✅ **SMS** with:
```
AI Tutor Platform: You completed [Course Name]. 
Score: 85% | Scaled: 680. View details: [link]
```

✅ **WhatsApp** message (same content as SMS)

#### Parent Receives (if linked):
✅ **Email** with:
- Subject: "Test Completion Report: [Student Name]'s [Test Name] Results"
- Student's score
- Performance analysis
- Link to parent dashboard

✅ **SMS** with:
```
AI Tutor Platform: [Student Name] completed [Test Name]. 
Score: 85% (680/1600). View full report: [link]
```

✅ **WhatsApp** message

### Verification Steps:

#### Check Email:
1. Open student's email inbox
2. Look for email from `noreply@yourapp.com`
3. Subject should match template
4. Content should show correct score

#### Check SMS:
1. Open student's phone SMS
2. Should receive within 2 minutes
3. Verify score matches test result

#### Check WhatsApp:
1. Open WhatsApp on student's phone
2. Message from Twilio sandbox number
3. Content should match SMS

#### Check Database:
```sql
-- Check if notification was queued
SELECT * FROM notification_outbox 
WHERE recipient_profile_id = 'STUDENT_ID'
AND event_type = 'TEST_COMPLETED'
ORDER BY created_at DESC
LIMIT 5;

-- Check processing status
SELECT * FROM notification_outbox 
WHERE payload->>'submissionId' = 'SUBMISSION_ID'
ORDER BY created_at DESC;
```

#### Check Backend Logs:
```
✅ [Notification] Test completion triggered for submission XYZ
✅ [Notification] Queued notification for student ABC
✅ [Notification] Queued notification for parent DEF
✅ [Outbox] Processing 2 notifications
✅ [Email] Sent test completion email to student@example.com
✅ [SMS] Sent test completion SMS to +918466924574
```

---

## 📊 Test Scenario 2: Weekly Progress Report

**What it tests:** Automatic weekly reports sent every Monday at 9 AM.

### Manual Trigger (for testing):

#### Option A: Via API Endpoint
```bash
curl -X POST https://your-backend.com/api/notifications/send-weekly-report \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "STUDENT_UUID",
    "forceSend": true
  }'
```

#### Option B: Via Admin Interface
1. Login as **Admin**
2. Go to `/admin/notifications`
3. Find student (e.g., Shashi)
4. Click "Send Weekly Report" button

### Expected Results:

#### Student Receives:
✅ **Email** with:
- Subject: "Weekly Progress Report"
- Tests attempted this week
- Average score & best score
- Complete test history table
- Study hours & lessons completed
- Current SAT Math/RW scores
- Achievements & recommendations

✅ **SMS** with:
```
AI Tutor Platform: Weekly report. Tests: 5, Avg: 78%, Best: 92%. 
Current total: 1370/1600. Keep it up!
```

✅ **WhatsApp** message with rich HTML format

#### Parent Receives:
✅ **Email** with:
- Subject: "Weekly Progress Report: [Student Name]"
- All student data above
- Parent-specific formatting

✅ **SMS** with:
```
AI Tutor Platform: Weekly update: [Student Name] attempted 5 tests, 
avg score 78%. Current total: 1370/1600. Full report: [link]
```

### Verification:

#### Check Email Content:
```
Hello [Student Name],

Here is your weekly performance summary:

Tests Taken: 5
Avg Score: 78%
Best Score: 92%

Test History This Week:
Date       | Course      | Level  | Score | Scaled
Jan 20     | SAT Math    | Medium | 85%   | 680
Jan 19     | SAT English | Hard   | 78%   | 620
Jan 18     | SAT Reading | Easy   | 92%   | 720
...

Current Scores:
- Math: 650/800
- Reading & Writing: 720/800
- Total: 1370/1600

Achievements:
✓ Completed 5 tests this week
✓ Maintained 78% average
✓ Improved Math score by 50 points

Keep up the great work!
```

#### Check Database:
```sql
-- Check weekly report notifications
SELECT * FROM notification_outbox 
WHERE event_type = 'WEEKLY_REPORT'
AND recipient_profile_id = 'STUDENT_ID'
ORDER BY created_at DESC
LIMIT 5;
```

---

## ⏰ Test Scenario 3: Test Due Date Reminder

**What it tests:** Reminders sent 24 hours before test due dates.

### Setup:
1. Login as **Tutor/Admin**
2. Create a test assignment with due date = tomorrow
3. Assign to student

### Expected Results:

#### Student Receives (24 hours before due):
✅ **Email** with:
- Subject: "Upcoming Test Due Dates"
- List of tests due soon
- Due dates and times
- Links to start tests

✅ **SMS** with:
```
AI Tutor Platform: Reminder: [Test Name] due tomorrow at 11:59 PM. 
Start now: [link]
```

✅ **WhatsApp** message

#### Parent Receives:
✅ **Email** with:
- Subject: "Upcoming Test Due Dates: [Student Name]"
- Student's pending tests
- Urgency indicators

✅ **SMS** with:
```
AI Tutor Platform: [Student Name] has [Test Name] due tomorrow. 
Encourage them to complete it: [link]
```

---

## 🎓 Test Scenario 4: Course Completion Report

**What it tests:** When student completes entire course.

### Setup:
1. Student completes ALL tests in a course
2. System detects 100% completion

### Expected Results:

#### Student Receives:
✅ **Email** with:
- Subject: "Course Completed: [Course Name]"
- Overall course score
- Certificate information
- Next course recommendations

✅ **SMS** with:
```
🎉 Congratulations! You completed [Course Name]. 
Overall score: 85%. Certificate available: [link]
```

#### Parent Receives:
✅ **Email** with:
- Subject: "Course Completed: [Student Name]'s Achievement"
- Celebration message
- Student's performance summary
- Next steps

---

## 🔔 Test Scenario 5: Low Score Alert

**What it tests:** Automatic alert when student scores below threshold (<40%).

### Setup:
1. Student takes a test
2. Scores below 40%

### Expected Results:

#### Student Receives:
✅ **Email** with:
- Subject: "Let's Improve Your Score: [Test Name]"
- Encouragement message
- Study resources
- Recommendation to retake

✅ **SMS** with:
```
AI Tutor Platform: Keep practicing! Your score on [Test Name] was 35%. 
Review materials: [link]
```

#### Parent Receives:
✅ **Email** with:
- Subject: "[Student Name] Needs Extra Support"
- Area of difficulty
- Suggested interventions
- Resources to help

---

## 📱 Multi-Channel Delivery Test

Verify notifications arrive via ALL channels:

### Email Delivery:
1. ✅ Check spam folder (should NOT be there)
2. ✅ Email renders correctly on mobile
3. ✅ Links work and go to correct pages
4. ✅ Images/logos display properly

### SMS Delivery:
1. ✅ Arrives within 2 minutes
2. ✅ Phone number format correct (+91...)
3. ✅ Message length appropriate (<160 chars ideal)
4. ✅ Links are shortened/clickable

### WhatsApp Delivery:
1. ✅ Rich formatting preserved
2. ✅ Links are clickable
3. ✅ Timestamps are correct
4. ✅ Sender shows as business account

---

## 🧪 Automated Testing Script

Use this script to test all scenarios:

**File:** `test-all-notifications.js`

```bash
node test-all-notifications.js --student=SHASHI_EMAIL --parent=PARENT_EMAIL
```

This will:
1. Trigger test completion notification
2. Send weekly progress report
3. Send due date reminder
4. Verify all channels
5. Generate test report

---

## 📊 Monitoring & Debugging

### Check Notification Outbox:
```sql
-- Recent notifications
SELECT 
  event_type,
  recipient_profile_id,
  status,
  created_at,
  processed_at
FROM notification_outbox
ORDER BY created_at DESC
LIMIT 20;

-- Failed notifications
SELECT * FROM notification_outbox
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Pending notifications
SELECT COUNT(*) FROM notification_outbox
WHERE status = 'pending';
```

### Check Backend Logs:
```bash
# Look for notification processing
tail -f backend.log | grep -i notification

# Check for errors
grep -i "error.*notification" backend.log

# Monitor outbox processing
grep "Outbox\|Processing" backend.log
```

### Check Email Delivery:
```bash
# If using Gmail
Check: Gmail → Sent folder
Look for emails from EMAIL_USER config

# Check bounce rate
Should be < 2%
```

### Check SMS/WhatsApp:
```bash
# Twilio Dashboard
https://console.twilio.com → Messaging → Logs

# Look for:
- Message status: delivered
- Error codes (should be none)
- Delivery timestamps
```

---

## ❌ Common Issues & Fixes

### Issue 1: Notifications Not Sending
**Symptoms:** Outbox has pending notifications but nothing sent

**Fix:**
```bash
# Restart backend
npm restart

# Manually process outbox
node scripts/process-outbox.js

# Check environment variables
echo $EMAIL_USER
echo $TWILIO_AUTH_TOKEN
```

### Issue 2: Only Email Works, SMS Fails
**Symptoms:** Emails arrive but SMS don't

**Fix:**
1. Check Twilio credentials in `.env`
2. Verify phone number format: `+918466924574` (with country code)
3. Check Twilio balance/credits
4. Verify Twilio sandbox setup for WhatsApp

### Issue 3: Parents Not Receiving Notifications
**Symptoms:** Student gets notifications but parents don't

**Fix:**
```sql
-- Check parent-student linkage
SELECT p.id, p.email, p.linked_students
FROM profiles p
WHERE p.role = 'parent';

-- Update linked_students if needed
UPDATE profiles
SET linked_students = array_append(linked_students, 'STUDENT_ID')
WHERE id = 'PARENT_ID';
```

### Issue 4: Weekly Reports Not Sending Automatically
**Symptoms:** Manual send works but cron doesn't trigger

**Fix:**
```bash
# Check if cron is running
ps aux | grep node

# Check cron schedule in code
grep -A 5 "cron.schedule" src/server/index.js

# Verify timezone
date  # Should match expected timezone
```

### Issue 5: Duplicate Notifications
**Symptoms:** Same notification sent multiple times

**Fix:**
```sql
-- Clear stuck outbox
DELETE FROM notification_outbox
WHERE status = 'pending'
AND created_at < NOW() - INTERVAL '1 hour';

-- Check for duplicate cron jobs
-- Restart backend to reset
```

---

## 📈 Success Metrics

After deployment, track these metrics:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Email delivery rate | > 98% | Email provider analytics |
| SMS delivery rate | > 95% | Twilio dashboard |
| WhatsApp delivery | > 90% | Twilio conversation logs |
| Time to deliver | < 2 min | Outbox `created_at` vs `processed_at` |
| Parent linkage rate | 100% | Database check |
| Weekly report success | Every Monday 9 AM | Cron job logs |

---

## 🎯 Final Verification Checklist

After completing all tests:

### For Students:
- [ ] Test completion email received
- [ ] Test completion SMS received
- [ ] Test completion WhatsApp received
- [ ] Weekly progress email received
- [ ] Can view all notifications in dashboard
- [ ] Notification preferences working

### For Parents:
- [ ] Child's test completion email received
- [ ] Child's test completion SMS received
- [ ] Weekly progress report received
- [ ] Due date reminders received
- [ ] Can access parent dashboard links

### For Admin/Tutors:
- [ ] Can manually trigger notifications
- [ ] Can view notification history
- [ ] Can manage student notification preferences
- [ ] Bulk notification tools working

### System Health:
- [ ] No failed notifications in outbox
- [ ] No error logs related to notifications
- [ ] Cron scheduler running
- [ ] Email/SMS/WhatsApp all functional
- [ ] Rate limiting working (no spam)

---

## 📞 Support

If issues persist:

1. **Check Documentation:**
   - `NOTIFICATION_SYSTEM_GUIDE.md`
   - `TWILIO_CONFIGURATION.md`
   - `COMPLETE_DATABASE_FIX_GUIDE.md`

2. **Run Diagnostics:**
   ```bash
   node test-notifications.js
   node diagnose-notification-system.js
   ```

3. **Check Logs:**
   - Backend terminal output
   - Supabase query logs
   - Twilio message logs

---

**Status:** Ready for post-deployment testing  
**Estimated Test Time:** 30-45 minutes  
**Success Criteria:** All scenarios pass ✅  
**Last Updated:** January 2025
