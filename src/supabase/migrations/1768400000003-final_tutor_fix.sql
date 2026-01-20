-- ==========================================================
-- FINAL TUTOR ACCESS FIX
-- ==========================================================

-- 1. Ensure all profiles have clean base data
UPDATE profiles SET assigned_courses = '{}' WHERE assigned_courses IS NULL;
UPDATE profiles SET tutor_approved = false WHERE tutor_approved IS NULL AND role = 'tutor';

-- 2. Grant explicit RLS permissions for Admins to manage profiles
-- This ensures that when an Admin clicks "Approve" or "Assign Course", 
-- the change is actually saved to the database.
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
CREATE POLICY "Admins can manage all profiles"
ON profiles FOR ALL TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- 3. Robust get_tutor_courses function
-- Optimized to use direct ANY check on the array column
DROP FUNCTION IF EXISTS get_tutor_courses(uuid);
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
BEGIN
  v_target_id := COALESCE(requested_user_id, auth.uid());
  
  -- Fetch basic info once
  SELECT role, assigned_courses INTO v_role, v_assigned 
  FROM profiles WHERE id = v_target_id;

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
    -- Admins see all
    (v_role = 'admin')
    OR
    -- Approved Tutors see assigned
    (v_role = 'tutor' AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = v_target_id AND tutor_approved = true)
      AND
      c.id = ANY(v_assigned)
    ))
  GROUP BY c.id, c.name, c.description, c.tutor_type, c.created_at;
END;
$$;

-- 4. Robust get_tutor_students function
DROP FUNCTION IF EXISTS get_tutor_students(bigint, uuid);
CREATE OR REPLACE FUNCTION get_tutor_students(
    course_filter bigint DEFAULT NULL, 
    requested_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  enrolled_course_id bigint,
  enrolled_at timestamptz,
  progress_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
  v_target_id uuid;
  v_assigned bigint[];
BEGIN
  v_target_id := COALESCE(requested_user_id, auth.uid());
  
  SELECT role, assigned_courses INTO v_role, v_assigned 
  FROM profiles WHERE id = v_target_id;

  RETURN QUERY
  SELECT 
    p.id, p.name, p.email, e.course_id as enrolled_course_id, e.enrolled_at,
    COUNT(pr.id)::bigint as progress_count
  FROM profiles p
  JOIN enrollments e ON e.user_id = p.id
  LEFT JOIN progress pr ON pr.user_id = p.id
  WHERE p.role = 'student'
  AND (
    (v_role = 'admin')
    OR
    (v_role = 'tutor' AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = v_target_id AND tutor_approved = true)
      AND
      e.course_id = ANY(v_assigned)
    ))
  )
  AND (course_filter IS NULL OR e.course_id = course_filter)
  GROUP BY p.id, p.name, p.email, e.course_id, e.enrolled_at
  ORDER BY e.enrolled_at DESC;
END;
$$;
