
-- NUCLEAR RLS RESET & REPAIR
-- This script wipes all common policy names and applies a robust, recursion-free architecture.

-- 1. Helper Function for non-recursive admin check
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT role = 'admin' 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Helper Function for non-recursive tutor check
CREATE OR REPLACE FUNCTION public.is_tutor() 
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT role = 'tutor' AND tutor_approved = true
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PROFILES REPAIR (The most critical failure)
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Wipe ALL possible policy names for profiles
DO $$ 
DECLARE 
  pol RECORD;
BEGIN 
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') 
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $$;

-- Apply fresh, simple policies
CREATE POLICY "profiles_select_self" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_all_admin" ON public.profiles FOR ALL TO authenticated USING (public.is_admin());

-- ============================================
-- COURSES REPAIR
-- ============================================
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
  pol RECORD;
BEGIN 
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'courses' AND schemaname = 'public') 
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON courses', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "courses_select_all" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "courses_manage_admin" ON public.courses FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "courses_manage_tutor" ON public.courses FOR ALL TO authenticated USING (public.is_tutor());

-- ============================================
-- ENROLLMENTS REPAIR
-- ============================================
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
  pol RECORD;
BEGIN 
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'enrollments' AND schemaname = 'public') 
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON enrollments', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "enrollments_select_self" ON public.enrollments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "enrollments_select_admin" ON public.enrollments FOR SELECT TO authenticated USING (public.is_admin() OR public.is_tutor());
CREATE POLICY "enrollments_all_admin" ON public.enrollments FOR ALL TO authenticated USING (public.is_admin());

-- ============================================
-- TEST_SUBMISSIONS REPAIR
-- ============================================
ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
  pol RECORD;
BEGIN 
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'test_submissions' AND schemaname = 'public') 
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON test_submissions', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "submissions_select_self" ON public.test_submissions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "submissions_select_admin" ON public.test_submissions FOR SELECT TO authenticated USING (public.is_admin() OR public.is_tutor());
CREATE POLICY "submissions_insert_self" ON public.test_submissions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "submissions_all_admin" ON public.test_submissions FOR ALL TO authenticated USING (public.is_admin());

-- ============================================
-- QUESTIONS REPAIR
-- ============================================
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
  pol RECORD;
BEGIN 
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'questions' AND schemaname = 'public') 
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON questions', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "questions_select_all" ON public.questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "questions_all_admin" ON public.questions FOR ALL TO authenticated USING (public.is_admin() OR public.is_tutor());

-- Final verification
SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public';
