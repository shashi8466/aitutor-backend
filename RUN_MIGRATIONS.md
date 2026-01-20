# Database Migration Guide

## 🎯 Run These Migrations on Supabase

You have **4 new migration files** that need to be executed in order on your Supabase database.

---

## 📋 Method 1: Supabase Dashboard (Easiest)

### Step-by-Step:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project: `aitutor`

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "+ New Query"

3. **Run Each Migration in Order**

   Copy and paste each file's contents into the SQL editor and click "Run":

   #### Migration 1: Add Tutor Role
   ```
   File: src/supabase/migrations/1768000000000-add_tutor_role.sql
   Purpose: Add tutor-specific fields and permissions
   ```

   #### Migration 2: Enrollment Keys
   ```
   File: src/supabase/migrations/1768100000000-create_enrollment_keys.sql
   Purpose: Create enrollment key system
   ```

   #### Migration 3: Invitation Links
   ```
   File: src/supabase/migrations/1768200000000-create_invitation_links.sql
   Purpose: Create invitation link system
   ```

   #### Migration 4: Advanced Grading
   ```
   File: src/supabase/migrations/1768300000000-create_test_submissions.sql
   Purpose: Create advanced grading system
   ```

4. **Verify Success**
   - After each migration, you should see "Success. No rows returned"
   - Check the "Table Editor" to see new tables:
     - `enrollment_keys`
     - `invitation_links`
     - `invitation_uses`
     - `test_submissions`
     - `grade_scales`

---

## 📋 Method 2: Supabase CLI (Advanced)

If you have Supabase CLI installed:

```bash
# Make sure you're in the project directory
cd "c:\Users\user\Downloads\-ai (1)\-ai (1)\educational-ai"

# Initialize Supabase (if not already done)
supabase init

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

---

## ✅ Verify Migrations

After running migrations, verify in Supabase Dashboard:

### New Tables Created:
- [ ] `enrollment_keys` - Stores enrollment keys
- [ ] `invitation_links` - Stores invitation links
- [ ] `invitation_uses` - Tracks invitation usage
- [ ] `test_submissions` - Stores test results
- [ ] `grade_scales` - Grading configuration

### Updated Tables:
- [ ] `profiles` - Now has tutor fields (tutor_specialty, tutor_bio, tutor_approved, assigned_courses)
- [ ] `questions` - Now has section fields (section, difficulty_weight, points)
- [ ] `enrollments` - Now has enrollment_key_id and enrollment_method

### New Functions:
- [ ] `is_approved_tutor()`
- [ ] `get_tutor_courses()`
- [ ] `get_tutor_students()`
- [ ] `validate_enrollment_key()`
- [ ] `use_enrollment_key()`
- [ ] `validate_invitation_link()`
- [ ] `track_invitation_use()`
- [ ] `complete_invitation_enrollment()`
- [ ] `submit_and_grade_test()`
- [ ] `calculate_scaled_score()`

---

## 🧪 Test After Migrations

### 1. Test Authentication
```
Navigate to: http://localhost:5173/login
✓ Should see role selector
✓ Click each role (Admin, Tutor, Student)
✓ Each should have its own login page
```

### 2. Test API Endpoints (Optional)

You can test the new API endpoints using a tool like Postman or curl:

```bash
# Health check
curl http://localhost:3001/api/health

# Check routes
curl http://localhost:3001/api/debug/routes
```

### 3. Create Test Tutor Account

After migrations, you can manually create a test tutor:

1. Go to Supabase Dashboard → Authentication → Users
2. Create a new user
3. Go to Table Editor → profiles → Find the new user
4. Set:
   - `role` = 'tutor'
   - `tutor_approved` = true
   - `tutor_specialty` = 'SAT Math'
5. Test login at `/login/tutor`

---

## 🐛 Troubleshooting

### Error: "relation already exists"
- Some tables might already exist
- Safe to ignore if the table structure is correct

### Error: "permission denied"
- Make sure you're using a user with appropriate permissions
- Try using the Service Role key

### Error: "function does not exist"
- Run the migrations in order
- Some functions depend on tables from previous migrations

---

## 📞 Need Help?

If migrations fail:
1. Check the error message in Supabase SQL editor
2. Verify you're running migrations in order
3. Check if tables already exist
4. Review RLS policies if permission errors occur

Ready to proceed with building the UI components!
