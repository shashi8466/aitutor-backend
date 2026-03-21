-- ============================================
-- COMPLETE SYSTEM DIAGNOSTIC FOR COURSES
-- Run this in Supabase SQL Editor
-- ============================================

-- STEP 1: Check if courses table exists and has data
SELECT 
  'Courses Table Status' as check_type,
  COUNT(*) as total_courses,
  COALESCE(MAX(name), 'No courses') as latest_course_name,
  COALESCE(MAX(created_at::text), 'N/A') as latest_course_date
FROM courses;

-- STEP 2: Show all courses with details
SELECT 
  id,
  name,
  description,
  created_at,
  updated_at
FROM courses
ORDER BY created_at DESC;

-- STEP 3: Check RLS policies on courses table
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'courses';

-- STEP 4: Check if RLS is enabled
SELECT 
  relname as table_name,
  relrowsecurity as rls_enabled,
  relforcerowsecurity as rls_forced
FROM pg_class
WHERE relname = 'courses';

-- STEP 5: Create permissive policy for authenticated users to SELECT courses
-- This allows anyone logged in to view courses
DROP POLICY IF EXISTS "Anyone can view courses" ON courses;
CREATE POLICY "Anyone can view courses" ON courses
FOR SELECT
TO authenticated
USING (true);

-- STEP 6: Allow admins/tutors to manage courses
DROP POLICY IF EXISTS "Admins and tutors can manage courses" ON courses;
CREATE POLICY "Admins and tutors can manage courses" ON courses
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'tutor')
  )
);

-- STEP 7: Verify your current user can access courses
SELECT 
  'Your User Info' as info_type,
  auth.uid() as your_user_id,
  (SELECT email FROM profiles WHERE id = auth.uid()) as your_email,
  (SELECT role FROM profiles WHERE id = auth.uid()) as your_role;

-- STEP 8: Test course access (this simulates what the app does)
SELECT 
  'Test Query Result' as test,
  c.id,
  c.name,
  c.description
FROM courses c
WHERE EXISTS (
  SELECT 1 FROM profiles p 
  WHERE p.id = auth.uid() AND p.role IN ('admin', 'tutor', 'student')
);

-- STEP 9: Count by status (if status column exists)
SELECT 
  COALESCE(status, 'unknown') as status,
  COUNT(*) as count
FROM courses
GROUP BY status;

-- STEP 10: Check for any enrollment keys linking to courses
SELECT 
  'Enrollment Keys' as info,
  COUNT(DISTINCT course_id) as courses_with_keys,
  COUNT(*) as total_keys
FROM enrollment_keys;

-- STEP 11: Diagnostic summary
SELECT 
  'DIAGNOSTIC SUMMARY' as section,
  '' as value
UNION ALL
SELECT 
  'Total Courses',
  COUNT(*)::text
FROM courses
UNION ALL
SELECT 
  'RLS Enabled',
  CASE WHEN relrowsecurity THEN 'YES' ELSE 'NO' END
FROM pg_class WHERE relname = 'courses'
UNION ALL
SELECT 
  'SELECT Policies',
  COUNT(*)::text
FROM pg_policies 
WHERE tablename = 'courses' AND cmd = 'SELECT'
UNION ALL
SELECT 
  'Your Role',
  COALESCE((SELECT role FROM profiles WHERE id = auth.uid()), 'NOT LOGGED IN');
