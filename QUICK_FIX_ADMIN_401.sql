-- ============================================
-- QUICK FIX: Admin Notification 401 Error
-- Run this FIRST in Supabase SQL Editor
-- ============================================

-- STEP 1: Check your current user's role
SELECT 
  id,
  email,
  name,
  role,
  created_at
FROM profiles
WHERE email = 'YOUR_ADMIN_EMAIL_HERE' -- Replace with your admin email
LIMIT 1;

-- If your role is NOT 'admin', run this:
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'YOUR_ADMIN_EMAIL_HERE'; -- Replace with your email

-- STEP 2: Verify RLS Policies exist
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
AND policyname LIKE '%admin%';

-- Required policies should be:
-- - admin_select_all_profiles (FOR SELECT)
-- - admin_update_notifications (FOR UPDATE)

-- STEP 3: Recreate RLS policies (if missing or broken)
DROP POLICY IF EXISTS admin_select_all_profiles ON profiles;
CREATE POLICY admin_select_all_profiles ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS admin_update_notifications ON profiles;
CREATE POLICY admin_update_notifications ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- STEP 4: Temporarily disable RLS for testing (OPTIONAL)
-- WARNING: Only do this for testing!
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- To re-enable later:
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- STEP 5: Test the query as your admin user
-- This simulates what the backend tries to do
SELECT 
  id,
  name,
  email,
  role,
  last_active_at,
  notification_preferences
FROM profiles
WHERE role = 'student'
ORDER BY name;

-- If this returns 0 rows, you have no students
-- If it returns rows, the issue is RLS/authentication

-- STEP 6: Count everything
SELECT 
  'Total Profiles' as metric,
  COUNT(*) as count
FROM profiles
UNION ALL
SELECT 'Students', COUNT(*) FROM profiles WHERE role = 'student'
UNION ALL
SELECT 'Parents', COUNT(*) FROM profiles WHERE role = 'parent'
UNION ALL
SELECT 'Admins', COUNT(*) FROM profiles WHERE role = 'admin';

-- STEP 7: Show all admins
SELECT id, email, name, created_at
FROM profiles
WHERE role = 'admin';
