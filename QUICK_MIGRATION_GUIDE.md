# Quick Migration Guide

## Option 1: Use Supabase Dashboard (Recommended - 5 minutes)

### Steps:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in sidebar
4. Click "New Query"
5. Copy each migration file and run in order:

**Run these in order:**
```
1. src/supabase/migrations/1768000000000-add_tutor_role.sql
2. src/supabase/migrations/1768100000000-create_enrollment_keys.sql
3. src/supabase/migrations/1768200000000-create_invitation_links.sql
4. src/supabase/migrations/1768300000000-create_test_submissions.sql
```

After each one, click ▶ Run and wait for "Success"

---

## Option 2: Use Migration Script (Alternative)

```bash
node run-migrations.js
```

---

## Verify Success

After migrations, check Table Editor in Supabase:

**New Tables:**
- enrollment_keys
- invitation_links
- invitation_uses
- test_submissions
- grade_scales

**Updated Tables:**
- profiles (will have new tutor columns)
- questions (will have section column)
- enrollments (will have enrollment_method column)

---

## Test After Migrations

1. Visit: http://localhost:5173/login
2. You should see the role selector
3. Try each login page

**Create Test Tutor:**
1. Supabase Dashboard → Auth → Users → Create user
2. Table Editor → profiles → Find new user
3. Set: role = 'tutor', tutor_approved = true
4. Test login!

Ready to proceed!
