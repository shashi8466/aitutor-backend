# Admin Notification Management System

## Overview

The **Admin Notification Management** system allows administrators to control notification settings for all students. This is particularly useful for managing inactive or offline students, ensuring they still receive important notifications about test completions, weekly reports, and due date reminders.

---

## Key Features

### ✅ 1. Centralized Control
- **Only admins** can manage student notification preferences
- Students **cannot** toggle their own notifications
- Admins can enable/disable notifications for individual students or in bulk

### ✅ 2. Student Activity Tracking
- View **active** vs **inactive** students (based on last login)
- Filter students by activity status
- Automatically identify students who haven't logged in for 7+ days

### ✅ 3. Bulk Operations
- Enable/disable all notifications for multiple students at once
- Quick actions for common tasks
- Force-enable notifications for inactive students

### ✅ 4. Multi-Channel Management
Control which channels each student can receive notifications through:
- **Email** - Detailed reports and summaries
- **SMS** - Quick alerts and reminders
- **WhatsApp** - Rich media notifications

---

## Accessing the Admin Panel

### Navigation Path:
1. Login as an **admin** user
2. Navigate to `/admin`
3. Click on **"Notifications"** in the sidebar (or go to `/admin/notifications`)

### UI Location:
- **Sidebar Link**: "Notifications" (with book icon)
- **Quick Action Card**: On admin dashboard home page

---

## Interface Features

### 1. Statistics Dashboard
At the top of the page, you'll see 6 stat cards:
- **Total Students**: Number of all student accounts
- **Active**: Students who logged in within last 7 days
- **Inactive**: Students inactive for 7+ days
- **Email Enabled**: Students with email notifications active
- **SMS Enabled**: Students with SMS notifications active
- **WhatsApp Enabled**: Students with WhatsApp notifications active

### 2. Search & Filters
- **Search Bar**: Find students by name or email
- **Filter Dropdown**:
  - `All Students` - Show everyone
  - `Active Only` - Show only active students
  - `Inactive Only` - Show only inactive students

### 3. Bulk Action Buttons
- **Enable All**: Turn ON all notification channels for filtered students
- **Disable All**: Turn OFF all notification channels for filtered students

### 4. Student Table
Each row shows:
- **Student Name & Email** (with avatar)
- **Status Badge**: Green "Active" or Red "Inactive"
- **Toggle Switches**: Email, SMS, WhatsApp (blue = enabled, gray = disabled)
- **Last Active Date**: When they last logged in
- **Quick Toggle Button**: Instant save for that student

---

## How to Use

### Scenario 1: Enable Notifications for Inactive Students

**Problem**: You have 50 students who haven't logged in for 2 weeks. You want them to still receive test reminders.

**Solution**:
1. Go to `/admin/notifications`
2. Select filter: `Inactive Only`
3. Click **"Enable All"** button
4. ✅ All inactive students now have email, SMS, and WhatsApp enabled

---

### Scenario 2: Disable SMS for Cost Saving

**Problem**: SMS costs money. You want to disable SMS for all students and only use email.

**Solution**:
1. Go to `/admin/notifications`
2. Manually toggle OFF the SMS switch for each student, OR
3. Use database query to bulk disable SMS (advanced)

**Better Approach**:
- Keep SMS for critical alerts only
- Use email for detailed reports
- Use WhatsApp as free alternative to SMS

---

### Scenario 3: Manage Individual Student

**Problem**: John's parent complains they're getting too many WhatsApp messages.

**Solution**:
1. Search for "John" in the search bar
2. Find John in the table
3. Toggle OFF WhatsApp switch
4. ✅ Parent will no longer receive WhatsApp messages for John

---

### Scenario 4: Force Enable All Notifications for At-Risk Students

**Problem**: Final exams are coming. You want ALL students (including inactive ones) to receive reminders.

**Solution**:
```bash
# Use the API endpoint directly
curl -X POST http://localhost:3001/api/admin/force-notify-inactive-students \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"daysThreshold": 30}'
```

This will enable email, SMS, and WhatsApp for all students inactive for 30+ days.

---

## API Endpoints

### 1. Get All Students with Preferences
```http
GET /api/admin/students-with-preferences
Authorization: Bearer <admin_token>
```

**Response**:
```json
{
  "success": true,
  "students": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "student",
      "last_active_at": "2025-01-20T10:30:00Z",
      "notification_preferences": {
        "email": true,
        "sms": false,
        "whatsapp": true,
        "testCompletion": true,
        "weeklyProgress": true,
        "testDueDate": true
      }
    }
  ]
}
```

---

### 2. Update Student Preferences
```http
PUT /api/admin/notification-preferences/:studentId
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "preferences": {
    "email": true,
    "sms": false,
    "whatsapp": true
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Preferences updated successfully"
}
```

---

### 3. Bulk Update Notifications
```http
POST /api/admin/bulk-notification-update
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "studentIds": ["uuid1", "uuid2", "uuid3"],
  "enabled": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully enabled notifications for 3 students"
}
```

---

### 4. Get Notification Statistics
```http
GET /api/admin/notification-stats
Authorization: Bearer <admin_token>
```

**Response**:
```json
{
  "success": true,
  "stats": {
    "total": 150,
    "active": 120,
    "inactive": 30,
    "emailEnabled": 140,
    "smsEnabled": 85,
    "whatsappEnabled": 95
  }
}
```

---

### 5. Force Notify Inactive Students
```http
POST /api/admin/force-notify-inactive-students
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "daysThreshold": 7
}
```

**Response**:
```json
{
  "success": true,
  "message": "Force-enabled notifications for 25 inactive students",
  "updated": 25
}
```

---

## Database Schema

### profiles table (modified)
```sql
ALTER TABLE profiles
ADD COLUMN notification_preferences JSONB DEFAULT '{
  "email": true,
  "sms": true,
  "whatsapp": false,
  "testCompletion": true,
  "weeklyProgress": true,
  "testDueDate": true
}';

ALTER TABLE profiles
ADD COLUMN last_active_at TIMESTAMP WITH TIME ZONE;
```

---

## Security

### Role-Based Access Control (RLS)
```sql
-- Only admins can update notification preferences
CREATE POLICY admin_update_notifications ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

### Backend Authentication
All API endpoints require:
1. Valid JWT token from authenticated user
2. User must have `role = 'admin'` in profiles table
3. Token passed in `Authorization: Bearer <token>` header

---

## Best Practices

### 1. Regular Audits
- **Weekly**: Check inactive student count
- **Monthly**: Review notification channel distribution
- **Before exams**: Force-enable all notifications

### 2. Cost Management
- **Email**: Free - use for everything
- **WhatsApp**: Free - use as primary push notification
- **SMS**: Paid (~$0.0075/message) - use for urgent alerts only

### 3. Communication Strategy
- **Test Completion**: Email + WhatsApp (detailed report)
- **Weekly Report**: Email only (long format)
- **Due Date Reminders**: WhatsApp + SMS (short urgent alerts)

### 4. Inactive Student Protocol
1. Identify students inactive for 7+ days
2. Enable all notification channels
3. Send personalized re-engagement message
4. Follow up with phone call if no response in 3 days

---

## Troubleshooting

### Issue: Can't access admin panel
**Solution**: Verify your user has `role = 'admin'` in database

```sql
SELECT id, name, email, role FROM profiles WHERE id = 'your-user-id';
```

### Issue: Changes not saving
**Solution**: Check backend logs for errors

```bash
# If running locally
tail -f logs/server.log

# Or check Render.com dashboard
https://dashboard.render.com > Your Server > Logs
```

### Issue: Student not receiving notifications
**Solution**:
1. Check student's notification preferences in admin panel
2. Verify contact info (email, phone number) is correct
3. Check notification outbox for failed deliveries
4. Review Twilio/email service provider logs

---

## Monitoring Queries

### Count students by notification channel
```sql
SELECT 
  COUNT(*) FILTER (WHERE notification_preferences->>'email' = 'true') as email_count,
  COUNT(*) FILTER (WHERE notification_preferences->>'sms' = 'true') as sms_count,
  COUNT(*) FILTER (WHERE notification_preferences->>'whatsapp' = 'true') as whatsapp_count,
  COUNT(*) as total_students
FROM profiles
WHERE role = 'student';
```

### Find inactive students with notifications disabled
```sql
SELECT 
  id,
  name,
  email,
  last_active_at,
  notification_preferences
FROM profiles
WHERE role = 'student'
  AND (
    last_active_at IS NULL 
    OR last_active_at < NOW() - INTERVAL '7 days'
  )
  AND (
    notification_preferences->>'email' = 'false'
    OR notification_preferences->>'sms' = 'false'
    OR notification_preferences->>'whatsapp' = 'false'
  );
```

---

## Future Enhancements

### Planned Features:
1. **Scheduled Bulk Operations**: Set rules like "auto-enable notifications for students inactive 14+ days"
2. **Notification Templates**: Custom messages for different student segments
3. **Analytics Dashboard**: Track open rates, click-through rates, engagement metrics
4. **A/B Testing**: Test different notification times and channels
5. **Parent Override**: Allow parents to request notification changes for their children

---

## Support

For issues or questions:
1. Check server logs first
2. Verify database RLS policies
3. Test API endpoints with Postman
4. Contact development team

---

**Last Updated**: January 2025  
**Version**: 1.0.0
