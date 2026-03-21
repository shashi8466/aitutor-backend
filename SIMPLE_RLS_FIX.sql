
-- SIMPLE & SAFE RLS REPAIR
-- This removes the recursion by allowing all authenticated users to read all profiles.
-- This is standard for profiles tables where names/roles need to be visible.

-- 1. Helper functions (SECURITY DEFINER to avoid recursion if needed for update/delete)
CREATE OR REPLACE FUNCTION public.check_admin_status() 
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated USING (public.check_admin_status());

-- 3. COURSES
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "courses_read_all" ON public.courses;
DROP POLICY IF EXISTS "courses_admin_all" ON public.courses;

CREATE POLICY "courses_read_all" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "courses_admin_all" ON public.courses FOR ALL TO authenticated USING (public.check_admin_status());

-- 4. ENROLLMENTS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "enrollments_read_self" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_admin_all" ON public.enrollments;

CREATE POLICY "enrollments_read_self" ON public.enrollments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.check_admin_status());
CREATE POLICY "enrollments_admin_all" ON public.enrollments FOR ALL TO authenticated USING (public.check_admin_status());

-- 5. TEST_SUBMISSIONS
ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "submissions_read_self" ON public.test_submissions;
DROP POLICY IF EXISTS "submissions_admin_all" ON public.test_submissions;

CREATE POLICY "submissions_read_self" ON public.test_submissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.check_admin_status());
CREATE POLICY "submissions_insert_self" ON public.test_submissions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "submissions_admin_all" ON public.test_submissions FOR ALL TO authenticated USING (public.check_admin_status());

-- Final check
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
