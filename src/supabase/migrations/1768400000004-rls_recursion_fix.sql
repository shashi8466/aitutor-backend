-- ==========================================================
-- EMERGENCY ACCESS & RLS REPAIR
-- ==========================================================

-- 1. Create a non-recursive way to check roles
-- Using SECURITY DEFINER to bypass the recursion trap
CREATE OR REPLACE FUNCTION check_is_admin() 
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Wipe and Re-create Profile Policies with NO recursion
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Policy: Everyone can see basic profile info (required for login roles)
CREATE POLICY "Profiles are viewable by authenticated users" 
ON profiles FOR SELECT TO authenticated USING (true);

-- Policy: Users can update their own profile (standard)
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy: Admins can do EVERYTHING (using our helper function)
CREATE POLICY "Admins have full profile control" 
ON profiles FOR ALL TO authenticated 
USING (check_is_admin());

-- 3. Robust Tutor Visibility RPC (V4)
-- Added strict COALESCE and array handling
CREATE OR REPLACE FUNCTION get_tutor_courses(requested_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  id bigint,
  name text,
  description text,
  tutor_type text,
  created_at timestamptz,
  enrolled_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
  v_target_id uuid;
  v_assigned bigint[];
  v_is_approved boolean;
BEGIN
  -- 1. Identify Target
  v_target_id := COALESCE(requested_user_id, auth.uid());
  
  -- 2. Fetch critical data using SECURITY DEFINER (this bypasses RLS safely)
  SELECT role, assigned_courses, tutor_approved 
  INTO v_role, v_assigned, v_is_approved
  FROM profiles WHERE id = v_target_id;

  -- 3. Return Logic
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.tutor_type,
    c.created_at,
    COUNT(DISTINCT e.user_id) as enrolled_count
  FROM courses c
  LEFT JOIN enrollments e ON e.course_id = c.id
  WHERE 
    -- Scenario A: Admin sees everything
    (v_role = 'admin')
    OR
    -- Scenario B: Tutor only sees assigned AND if approved
    (
      v_role = 'tutor' 
      AND v_is_approved = true 
      AND c.id = ANY(COALESCE(v_assigned, ARRAY[]::bigint[]))
    )
  GROUP BY c.id, c.name, c.description, c.tutor_type, c.created_at;
END;
$$;

-- 4. Sync metadata to ensure the next login is smooth
UPDATE auth.users u
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', p.role, 'name', p.name)
FROM public.profiles p
WHERE u.id = p.id;
