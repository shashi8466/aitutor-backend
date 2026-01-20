-- CRITICAL FIX: Update RPC functions to accept an explicit user_id
-- This allows the server-side Node.js environment to fetch data on behalf of the user
-- since the server-side Supabase client often lacks the user's JWT session.

-- 1. Updated get_tutor_courses
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
BEGIN
  -- Use provided ID or fallback to auth.uid()
  v_target_id := COALESCE(requested_user_id, auth.uid());
  
  -- Get role for the target user
  SELECT role INTO v_role FROM profiles WHERE id = v_target_id;

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
    -- If admin, show everything
    (v_role = 'admin')
    OR
    -- If tutor, show only assigned
    (v_role = 'tutor' AND c.id = ANY(
      SELECT unnest(assigned_courses) 
      FROM profiles 
      WHERE id = v_target_id 
      AND tutor_approved = true
    ))
  GROUP BY c.id, c.name, c.description, c.tutor_type, c.created_at;
END;
$$;

-- 2. Updated get_tutor_students
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
BEGIN
  -- Use provided ID or fallback to auth.uid()
  v_target_id := COALESCE(requested_user_id, auth.uid());

  -- Get role for the target user
  SELECT role INTO v_role FROM profiles WHERE id = v_target_id;

  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.email,
    e.course_id as enrolled_course_id,
    e.enrolled_at,
    COUNT(pr.id)::bigint as progress_count
  FROM profiles p
  JOIN enrollments e ON e.user_id = p.id
  LEFT JOIN progress pr ON pr.user_id = p.id
  WHERE p.role = 'student'
  AND (
    -- If admin, show students in the filtered course or all if no filter
    (v_role = 'admin')
    OR
    -- If tutor, show only students in assigned courses
    (v_role = 'tutor' AND e.course_id = ANY(
      SELECT unnest(assigned_courses) 
      FROM profiles 
      WHERE id = v_target_id 
      AND tutor_approved = true
    ))
  )
  AND (course_filter IS NULL OR e.course_id = course_filter)
  GROUP BY p.id, p.name, p.email, e.course_id, e.enrolled_at
  ORDER BY e.enrolled_at DESC;
END;
$$;
