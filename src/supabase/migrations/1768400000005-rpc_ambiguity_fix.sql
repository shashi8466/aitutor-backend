-- ==========================================================
-- FINAL TUTOR RPC REPAIR (Ambiguity Fix)
-- ==========================================================

-- 1. Fix get_tutor_courses
-- Renaming the output columns in the definition to avoid name collision with table columns
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
  v_assigned bigint[];
  v_approved boolean;
BEGIN
  -- Fetch profile data into local variables first
  -- Using "profiles.id" explicitly to avoid ambiguity with the table column
  SELECT p.role, p.assigned_courses, p.tutor_approved 
  INTO v_role, v_assigned, v_approved
  FROM public.profiles p 
  WHERE p.id = COALESCE(requested_user_id, auth.uid());

  RETURN QUERY
  SELECT 
    c.id as id,
    c.name as name,
    c.description as description,
    c.tutor_type as tutor_type,
    c.created_at as created_at,
    COUNT(DISTINCT e.user_id)::bigint as enrolled_count
  FROM public.courses c
  LEFT JOIN public.enrollments e ON e.course_id = c.id
  WHERE 
    (v_role = 'admin')
    OR
    (v_role = 'tutor' AND v_approved = true AND c.id = ANY(COALESCE(v_assigned, '{}'::bigint[])))
  GROUP BY c.id, c.name, c.description, c.tutor_type, c.created_at;
END;
$$;

-- 2. Fix get_tutor_students
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
  v_assigned bigint[];
  v_approved boolean;
BEGIN
  SELECT p.role, p.assigned_courses, p.tutor_approved 
  INTO v_role, v_assigned, v_approved
  FROM public.profiles p 
  WHERE p.id = COALESCE(requested_user_id, auth.uid());

  RETURN QUERY
  SELECT 
    prof.id as id,
    prof.name as name,
    prof.email as email,
    enr.course_id as enrolled_course_id,
    enr.enrolled_at as enrolled_at,
    COUNT(prog.id)::bigint as progress_count
  FROM public.profiles prof
  JOIN public.enrollments enr ON enr.user_id = prof.id
  LEFT JOIN public.student_progress prog ON prog.user_id = prof.id
  WHERE prof.role = 'student'
  AND (
    (v_role = 'admin')
    OR
    (v_role = 'tutor' AND v_approved = true AND enr.course_id = ANY(COALESCE(v_assigned, '{}'::bigint[])))
  )
  AND (course_filter IS NULL OR enr.course_id = course_filter)
  GROUP BY prof.id, prof.name, prof.email, enr.course_id, enr.enrolled_at
  ORDER BY enr.enrolled_at DESC;
END;
$$;
