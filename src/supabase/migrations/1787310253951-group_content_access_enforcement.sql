-- Group-Based Content Access enforcement.
--
-- student_groups.assigned_content / assigned_course_ids already exist live in
-- production (set by the "Assign Content" UI) but only ever drove analytics
-- scoping. This migration formalizes those drifted columns and makes them a
-- real, unbypassable access grant: additive on top of a student's existing
-- direct access (enrollment / plan), enforced via RLS so a direct URL/API
-- call can't route around it. Students who belong to zero groups are
-- completely unaffected (is_group_member() short-circuits every check below
-- to `true`), so Plan Management's existing behavior is untouched for them.

-- 1. Formalize drifted columns (idempotent, no data change).
ALTER TABLE student_groups
  ADD COLUMN IF NOT EXISTS assigned_content jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS assigned_course_ids bigint[] DEFAULT '{}'::bigint[];

-- 2. Helper functions. SECURITY DEFINER is required: group_members has no
-- student self-SELECT RLS policy (only a tutor/admin "manage own groups"
-- policy), so an INVOKER function would see zero rows for the very student
-- it's checking.

CREATE OR REPLACE FUNCTION is_group_member(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM group_members WHERE student_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION get_group_granted_course_ids(p_user_id uuid)
RETURNS bigint[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT cid), '{}'::bigint[])
  FROM group_members gm
  JOIN student_groups sg ON sg.id = gm.group_id
  CROSS JOIN LATERAL unnest(COALESCE(sg.assigned_course_ids, '{}'::bigint[])) AS cid
  WHERE gm.student_id = p_user_id;
$$;

-- "Direct access" = access the student would have with zero group
-- membership: an existing enrollment, a premium plan (bypasses everything,
-- mirroring planService.checkAccess's premium rule), or a whole-course
-- plan_content_access whitelist row. Deliberately does not replicate
-- checkAccess's topic/test -> course inherited-whitelist nuance (narrow,
-- accepted simplification).
CREATE OR REPLACE FUNCTION has_direct_course_access(p_user_id uuid, p_course_id bigint)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_type text;
BEGIN
  IF EXISTS (SELECT 1 FROM enrollments WHERE user_id = p_user_id AND course_id = p_course_id) THEN
    RETURN true;
  END IF;

  SELECT lower(coalesce(plan_type, 'free')) INTO v_plan_type
  FROM profiles WHERE id = p_user_id;

  IF v_plan_type = 'premium' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM plan_content_access
    WHERE content_type = 'course'
      AND content_id = p_course_id::text
      AND plan_type = coalesce(v_plan_type, 'free')
  );
END;
$$;

-- Single source of truth, used by RLS policies below and by the server.
CREATE OR REPLACE FUNCTION is_course_accessible(p_user_id uuid, p_course_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT is_group_member(p_user_id)
    OR has_direct_course_access(p_user_id, p_course_id)
    OR p_course_id = ANY (get_group_granted_course_ids(p_user_id));
$$;

GRANT EXECUTE ON FUNCTION is_group_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_granted_course_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION has_direct_course_access(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION is_course_accessible(uuid, bigint) TO authenticated;

-- 3. RESTRICTIVE RLS policies. Postgres ORs permissive policies together
-- then ANDs the result against restrictive ones, so these are a pure no-op
-- for any student in zero groups (is_course_accessible short-circuits to
-- true) and only narrow results for group-restricted students. The existing
-- permissive `USING (true)` policies on courses/questions are untouched.

DROP POLICY IF EXISTS "group_restricted_course_access" ON courses;
CREATE POLICY "group_restricted_course_access"
ON courses AS RESTRICTIVE FOR SELECT TO authenticated
USING (is_course_accessible(auth.uid(), id));

DROP POLICY IF EXISTS "group_restricted_question_access" ON questions;
CREATE POLICY "group_restricted_question_access"
ON questions AS RESTRICTIVE FOR SELECT TO authenticated
USING (is_course_accessible(auth.uid(), course_id));

-- Closes the existing open self-insert enrollment policy as a bypass route
-- (e.g. CourseView.jsx's direct-insert enrollment fallback) for restricted
-- students; no-op for everyone else.
DROP POLICY IF EXISTS "group_restricted_enrollment_insert" ON enrollments;
CREATE POLICY "group_restricted_enrollment_insert"
ON enrollments AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (is_course_accessible(user_id, course_id));

-- 4. Close the enrollment-key redemption bypass. Both functions are
-- SECURITY DEFINER and insert into enrollments bypassing RLS by ownership,
-- so the RESTRICTIVE policy above cannot reach them; guard explicitly.

CREATE OR REPLACE FUNCTION use_enrollment_key(
    p_key_code text,
    p_user_id uuid,
    p_intended_course_id bigint DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  error_message text,
  enrollment_id bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation RECORD;
  v_existing_enrollment bigint;
  v_new_enrollment_id bigint;
BEGIN
  p_key_code := trim(upper(p_key_code));
  SELECT * INTO v_validation FROM validate_enrollment_key(p_key_code);

  IF NOT v_validation.valid THEN
    RETURN QUERY SELECT false, v_validation.error_message, NULL::bigint;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN QUERY SELECT false, 'User profile not found'::text, NULL::bigint;
    RETURN;
  END IF;

  -- GLOBAL KEY: enroll in all courses not already enrolled, restricted to
  -- courses the user is actually allowed to access.
  IF v_validation.course_id IS NULL THEN
    INSERT INTO enrollments (user_id, course_id, enrollment_key_id, enrollment_method)
    SELECT p_user_id, c.id, v_validation.key_id, 'key'
    FROM courses c
    WHERE NOT EXISTS (
      SELECT 1 FROM enrollments e WHERE e.user_id = p_user_id AND e.course_id = c.id
    )
    AND is_course_accessible(p_user_id, c.id);

    UPDATE enrollment_keys
    SET current_uses = current_uses + 1, updated_at = now()
    WHERE id = v_validation.key_id;

    RETURN QUERY SELECT true, 'Successfully enrolled in all courses'::text, NULL::bigint;
    RETURN;
  END IF;

  -- SINGLE COURSE KEY: strict binding check
  IF p_intended_course_id IS NOT NULL AND v_validation.course_id != p_intended_course_id THEN
    RETURN QUERY SELECT false, 'This enrollment key is for ' || v_validation.course_name || ' and cannot be used here.'::text, NULL::bigint;
    RETURN;
  END IF;

  IF NOT is_course_accessible(p_user_id, v_validation.course_id) THEN
    RETURN QUERY SELECT false, 'This course is not included in your current access.'::text, NULL::bigint;
    RETURN;
  END IF;

  SELECT id INTO v_existing_enrollment
  FROM enrollments
  WHERE user_id = p_user_id AND course_id = v_validation.course_id;

  IF v_existing_enrollment IS NOT NULL THEN
    RETURN QUERY SELECT false, 'You are already enrolled in ' || v_validation.course_name::text, v_existing_enrollment;
    RETURN;
  END IF;

  INSERT INTO enrollments (user_id, course_id, enrollment_key_id, enrollment_method)
  VALUES (p_user_id, v_validation.course_id, v_validation.key_id, 'key')
  RETURNING id INTO v_new_enrollment_id;

  UPDATE enrollment_keys
  SET current_uses = current_uses + 1, updated_at = now()
  WHERE id = v_validation.key_id;

  RETURN QUERY SELECT true, 'Successfully enrolled in ' || v_validation.course_name::text, v_new_enrollment_id;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, SQLERRM, NULL::bigint;
END;
$$;

CREATE OR REPLACE FUNCTION enroll_global_key_users_in_new_course()
RETURNS TRIGGER AS $$
DECLARE
    v_key RECORD;
BEGIN
    FOR v_key IN
        SELECT id FROM enrollment_keys
        WHERE key_type = 'global' AND auto_enroll_new_courses = true AND is_active = true
    LOOP
        INSERT INTO enrollments (user_id, course_id, enrollment_key_id, enrollment_method)
        SELECT DISTINCT e.user_id, NEW.id, v_key.id, 'key'
        FROM enrollments e
        WHERE e.enrollment_key_id = v_key.id
          AND NOT EXISTS (
              SELECT 1 FROM enrollments ex
              WHERE ex.user_id = e.user_id AND ex.course_id = NEW.id
          )
          AND is_course_accessible(e.user_id, NEW.id);
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Convenience RPCs for the client.
--
-- get_my_accessible_course_ids() mirrors the RLS-filtered courses table
-- exactly (a non-grouped student gets EVERY course back, since RLS never
-- encoded plan restrictions -- only the group restriction added above). It
-- is useful for confirming RLS is behaving, or for an empty-state message,
-- but must NOT be used to widen any client-side plan-whitelist filter --
-- doing so would leak every course to non-grouped free-plan students.
CREATE OR REPLACE FUNCTION get_my_accessible_course_ids()
RETURNS bigint[]
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(id), '{}'::bigint[]) FROM courses;
$$;

-- get_my_group_granted_course_ids() is the precise signal for widening a
-- client-side display filter: only the courses actually granted via the
-- caller's own group membership (empty for a non-grouped student). Use this,
-- not get_my_accessible_course_ids(), to OR into Plan Management's existing
-- course-list/topic-access checks.
CREATE OR REPLACE FUNCTION get_my_group_granted_course_ids()
RETURNS bigint[]
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT get_group_granted_course_ids(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION get_my_accessible_course_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_group_granted_course_ids() TO authenticated;
