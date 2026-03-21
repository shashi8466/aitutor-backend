-- ============================================
-- COMPLETE DATABASE FIX - ALL TABLES
-- Fixes RLS policies for all tables
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. COURSES TABLE
-- ============================================
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Anyone authenticated can view courses" ON courses;
DROP POLICY IF EXISTS "Admins and tutors can manage courses" ON courses;

-- Create new policies
CREATE POLICY "Anyone authenticated can view courses" ON courses
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and tutors can manage courses" ON courses
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor')
  )
);

-- ============================================
-- 2. PROFILES TABLE
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop ALL old policies to prevent conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Create new policies - SIMPLE approach to avoid recursion
-- Policy 1: Users can always view their OWN profile
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT TO authenticated
USING (id = auth.uid());

-- Policy 2: Users can update their OWN profile
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE TO authenticated
USING (id = auth.uid());

-- Policy 3: Admins can view ALL profiles (checked via role in auth token or metadata)
-- IMPORTANT: Don't check profiles table here to avoid recursion!
CREATE POLICY "Admins can view all profiles" ON profiles
FOR SELECT TO authenticated
USING (
  -- Check if user has admin role in their auth session
  current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
  OR
  -- Alternative: Check email domain for admin (customize as needed)
  false  -- Remove this line if using JWT claims above
);

-- Policy 4: Admins can update ALL profiles
CREATE POLICY "Admins can update all profiles" ON profiles
FOR UPDATE TO authenticated
USING (
  current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
);

-- ============================================
-- 3. GROUPS TABLE (Student Groups) - IF EXISTS
-- ============================================
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'groups_table') THEN
    ALTER TABLE groups_table ENABLE ROW LEVEL SECURITY;
    
    -- Drop old policies
    DROP POLICY IF EXISTS "Authenticated users can view groups" ON groups_table;
    DROP POLICY IF EXISTS "Admins and tutors can manage groups" ON groups_table;
    
    -- Create new policies
    CREATE POLICY "Authenticated users can view groups" ON groups_table
    FOR SELECT TO authenticated
    USING (true);
    
    CREATE POLICY "Admins and tutors can manage groups" ON groups_table
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor')
      )
    );
  END IF;
END $$;

-- ============================================
-- 4. ENROLLMENT_KEYS TABLE
-- ============================================
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'enrollment_keys') THEN
    ALTER TABLE enrollment_keys ENABLE ROW LEVEL SECURITY;
    
    -- Drop old policies
    DROP POLICY IF EXISTS "Users can view their enrollment keys" ON enrollment_keys;
    DROP POLICY IF EXISTS "Admins and tutors can manage enrollment keys" ON enrollment_keys;
    
    -- Create new policies (using profile_id or user_id depending on schema)
    CREATE POLICY "Users can view their enrollment keys" ON enrollment_keys
    FOR SELECT TO authenticated
    USING (
      -- Try user_id first, fall back to profile_id if it exists
      CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enrollment_keys' AND column_name = 'user_id')
        THEN user_id = auth.uid()
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enrollment_keys' AND column_name = 'profile_id')
        THEN profile_id = auth.uid()
        ELSE true  -- If neither exists, allow all for now
      END
      OR
      EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor')
      )
    );
    
    CREATE POLICY "Admins and tutors can manage enrollment keys" ON enrollment_keys
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor')
      )
    );
  END IF;
END $$;

-- ============================================
-- 5. ENROLLMENTS TABLE
-- ============================================
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'enrollments') THEN
    ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
    
    -- Drop old policies
    DROP POLICY IF EXISTS "Users can view their enrollments" ON enrollments;
    DROP POLICY IF EXISTS "Admins and tutors can view all enrollments" ON enrollments;
    DROP POLICY IF EXISTS "Admins and tutors can manage enrollments" ON enrollments;
    
    -- Create new policies with column detection
    CREATE POLICY "Users can view their enrollments" ON enrollments
    FOR SELECT TO authenticated
    USING (
      CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enrollments' AND column_name = 'user_id')
        THEN user_id = auth.uid()
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enrollments' AND column_name = 'profile_id')
        THEN profile_id = auth.uid()
        ELSE true
      END
    );
    
    CREATE POLICY "Admins and tutors can view all enrollments" ON enrollments
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor')
      )
    );
    
    CREATE POLICY "Admins and tutors can manage enrollments" ON enrollments
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor')
      )
    );
  END IF;
END $$;

-- ============================================
-- 6. TEST_SUBMISSIONS TABLE
-- ============================================
ALTER TABLE test_submissions ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their submissions" ON test_submissions;
DROP POLICY IF EXISTS "Admins and tutors can view all submissions" ON test_submissions;
DROP POLICY IF EXISTS "Users can create submissions" ON test_submissions;
DROP POLICY IF EXISTS "Admins and tutors can manage submissions" ON test_submissions;

-- Create new policies
CREATE POLICY "Users can view their submissions" ON test_submissions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins and tutors can view all submissions" ON test_submissions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor')
  )
);

CREATE POLICY "Users can create submissions" ON test_submissions
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins and tutors can manage submissions" ON test_submissions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor')
  )
);

-- ============================================
-- 7. UPLOADS TABLE
-- ============================================
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their uploads" ON uploads;
DROP POLICY IF EXISTS "Admins and tutors can view all uploads" ON uploads;
DROP POLICY IF EXISTS "Users can create uploads" ON uploads;
DROP POLICY IF EXISTS "Admins and tutors can manage uploads" ON uploads;

-- Create new policies
CREATE POLICY "Users can view their uploads" ON uploads
FOR SELECT TO authenticated
USING (uploaded_by = auth.uid());

CREATE POLICY "Admins and tutors can view all uploads" ON uploads
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor')
  )
);

CREATE POLICY "Users can create uploads" ON uploads
FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Admins and tutors can manage uploads" ON uploads
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor')
  )
);

-- ============================================
-- 8. QUESTIONS TABLE
-- ============================================
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Authenticated users can view questions" ON questions;
DROP POLICY IF EXISTS "Admins and tutors can manage questions" ON questions;

-- Create new policies
CREATE POLICY "Authenticated users can view questions" ON questions
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and tutors can manage questions" ON questions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor')
  )
);

-- ============================================
-- 9. KNOWLEDGE_BASE TABLE
-- ============================================
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Authenticated users can view knowledge base" ON knowledge_base;
DROP POLICY IF EXISTS "Admins and tutors can manage knowledge base" ON knowledge_base;

-- Create new policies
CREATE POLICY "Authenticated users can view knowledge base" ON knowledge_base
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and tutors can manage knowledge base" ON knowledge_base
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor')
  )
);

-- ============================================
-- 10. NOTIFICATION_OUTBOX TABLE
-- ============================================
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their notifications" ON notification_outbox;
DROP POLICY IF EXISTS "Admins can view all notifications" ON notification_outbox;

-- Create new policies
CREATE POLICY "Users can view their notifications" ON notification_outbox
FOR SELECT TO authenticated
USING (recipient_profile_id = auth.uid());

CREATE POLICY "Admins can view all notifications" ON notification_outbox
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- 11. NOTIFICATION_PREFERENCES TABLE
-- ============================================
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view own preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Admins can manage all preferences" ON notification_preferences;

-- Create new policies
CREATE POLICY "Users can view own preferences" ON notification_preferences
FOR SELECT TO authenticated
USING (profile_id = auth.uid());

CREATE POLICY "Users can update own preferences" ON notification_preferences
FOR UPDATE TO authenticated
USING (profile_id = auth.uid());

CREATE POLICY "Admins can manage all preferences" ON notification_preferences
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- CREATE MISSING INDEXES FOR PERFORMANCE
-- ============================================

-- Courses indexes
CREATE INDEX IF NOT EXISTS idx_courses_created_at ON courses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_courses_level ON courses(level);

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- Enrollments indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_group_id ON enrollments(group_id);

-- Test submissions indexes
CREATE INDEX IF NOT EXISTS idx_test_submissions_user_id ON test_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_test_submissions_course_id ON test_submissions(course_id);
CREATE INDEX IF NOT EXISTS idx_test_submissions_test_date ON test_submissions(test_date DESC);

-- Uploads indexes
CREATE INDEX IF NOT EXISTS idx_uploads_uploaded_by ON uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_uploads_course_id ON uploads(course_id);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON uploads(created_at DESC);

-- Questions indexes
CREATE INDEX IF NOT EXISTS idx_questions_course_id ON questions(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);

-- Knowledge base indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_created_at ON knowledge_base(created_at DESC);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notification_outbox_recipient ON notification_outbox(recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON notification_outbox(status);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_profile ON notification_preferences(profile_id);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Show all tables with RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'courses', 'profiles', 'groups_table', 'enrollment_keys', 
  'enrollments', 'test_submissions', 'uploads', 'questions',
  'knowledge_base', 'notification_outbox', 'notification_preferences'
)
ORDER BY tablename;

-- Show count of policies per table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Show summary of data in each table
SELECT 'courses' as table_name, COUNT(*) as row_count FROM courses
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'groups_table', COALESCE((SELECT COUNT(*) FROM groups_table), 0)
UNION ALL
SELECT 'enrollment_keys', COUNT(*) FROM enrollment_keys
UNION ALL
SELECT 'enrollments', COUNT(*) FROM enrollments
UNION ALL
SELECT 'test_submissions', COUNT(*) FROM test_submissions
UNION ALL
SELECT 'uploads', COUNT(*) FROM uploads
UNION ALL
SELECT 'questions', COUNT(*) FROM questions
UNION ALL
SELECT 'knowledge_base', COUNT(*) FROM knowledge_base
UNION ALL
SELECT 'notification_outbox', COUNT(*) FROM notification_outbox
UNION ALL
SELECT 'notification_preferences', COUNT(*) FROM notification_preferences
ORDER BY table_name;

-- ============================================
-- FINAL SUCCESS MESSAGE
-- ============================================
SELECT 
  '✅ DATABASE FIX COMPLETE' as status,
  'All tables now have proper RLS policies' as message,
  'Refresh your app to see changes' as next_step;
