# Demo Lead Submission - 404 Error Fix

## Problem
`POST /api/demo/submit-lead` is returning 404 on the deployed backend at `https://aitutor-backend-u7h3.onrender.com`

## Root Cause Analysis

The route EXISTS in the codebase:
- ✅ Route defined in: `src/server/routes/demo.js` (line 8)
- ✅ Route imported in: `src/server/index.js` (line 26)
- ✅ Route mounted in: `src/server/index.js` (line 143): `app.use('/api/demo', demoRoutes);`

**The 404 error means one of two things:**
1. The backend code hasn't been deployed to Render yet
2. The database migration hasn't been run (table `demo_leads` doesn't exist)

## Solution Steps

### Step 1: Verify Backend Deployment on Render

1. Go to your Render Dashboard: https://dashboard.render.com
2. Find your backend service: `aitutor-backend`
3. Check the deployment status:
   - If there's a pending deployment → Wait for it to complete
   - If the last deployment was before you added the demo routes → **Manually trigger a new deployment**
4. After deployment, test the health endpoint:
   ```
   https://aitutor-backend-u7h3.onrender.com/api/health
   ```

### Step 2: Apply Database Migration to Supabase

The `demo_leads` table needs to be created in your Supabase database.

**Option A: Using Supabase Dashboard (Recommended)**
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste the migration SQL from: `src/supabase/migrations/1776510000000-add_demo_course_flag.sql`
5. Click **Run** to execute

**Option B: Using Supabase CLI**
```bash
supabase db push
```

### Step 3: Verify the Migration

Run this SQL in Supabase SQL Editor to verify the table exists:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'demo_leads';
```

You should see these columns:
- id
- course_id
- full_name
- grade
- email
- phone
- level_completed
- score_details
- created_at

### Step 4: Test the API Endpoint

**Test with curl:**
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

**Expected Response:**
```json
{
  "success": true,
  "message": "Lead saved and score sent via email"
}
```

### Step 5: Check Backend Logs on Render

If you still get 404 after deployment:
1. Go to Render Dashboard
2. Click on your backend service
3. Go to **Logs** tab
4. Look for these log messages when testing:
   - `📩 [DEMO] Lead Submission: ...`
   - Any error messages

## What the Route Does

When a user submits the demo lead form, the backend:

1. **Saves lead to database** (`demo_leads` table)
   - Stores: name, grade, email, phone, level, score details
   
2. **Fetches course details** from `courses` table
   - Gets course name for the email
   
3. **Sends score email** to the user's email
   - Uses Brevo email service
   - Contains score details and predicted SAT score
   
4. **Returns success response** to frontend

## Frontend Code Location

- Form component: `src/components/demo/DemoLeadForm.jsx`
- Submission handler: `src/components/demo/PublicDemoQuizInterface.jsx` (line 165-214)
- API call: `axios.post('/api/demo/submit-lead', {...})` (line 194)

## Common Issues

### Issue 1: Still getting 404 after deployment
**Solution:** 
- Clear browser cache
- Hard refresh (Ctrl+Shift+R)
- Check Render logs to confirm the deployment included the demo routes

### Issue 2: Getting 500 error instead of 404
**Solution:**
- The `demo_leads` table doesn't exist in Supabase
- Run the migration SQL (Step 2)

### Issue 3: Email not being sent
**Solution:**
- Check Brevo API key in Render environment variables
- Check Render logs for email sending errors
- The lead will still be saved even if email fails

## Testing Checklist

- [ ] Backend deployed on Render with latest code
- [ ] Migration applied to Supabase
- [ ] `demo_leads` table exists with correct columns
- [ ] Health endpoint responds: `/api/health`
- [ ] Demo endpoint responds: `POST /api/demo/submit-lead`
- [ ] Email configured (Brevo API key set)
- [ ] Frontend can successfully submit lead form
- [ ] Lead appears in Supabase `demo_leads` table
- [ ] Email received by test user

## Quick Verification Script

Create a file `test-demo-api.js` and run:
```javascript
import axios from 'axios';

async function testDemoAPI() {
  const BACKEND_URL = 'https://aitutor-backend-u7h3.onrender.com';
  
  console.log('🧪 Testing Demo API...\n');
  
  // Test 1: Health Check
  try {
    const health = await axios.get(`${BACKEND_URL}/api/health`);
    console.log('✅ Health Check:', health.data.status);
  } catch (error) {
    console.log('❌ Health Check Failed:', error.message);
    return;
  }
  
  // Test 2: Submit Lead
  try {
    const response = await axios.post(`${BACKEND_URL}/api/demo/submit-lead`, {
      courseId: 1,
      fullName: 'Test User',
      grade: '10',
      email: 'test@example.com',
      phone: '+1234567890',
      level: 'Easy',
      scoreDetails: {
        correctCount: 5,
        totalQuestions: 10,
        currentLevelPercentage: 50,
        scaledScore: 1200
      }
    });
    console.log('✅ Lead Submission:', response.data.message);
  } catch (error) {
    if (error.response) {
      console.log('❌ Lead Submission Failed:', error.response.status);
      console.log('Response:', error.response.data);
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }
}

testDemoAPI();
```

Run with:
```bash
node test-demo-api.js
```
