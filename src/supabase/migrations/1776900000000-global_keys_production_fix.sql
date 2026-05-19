-- ============================================================
-- GLOBAL ENROLLMENT KEYS - COMPLETE PRODUCTION MIGRATION
-- Run this in Supabase SQL Editor to fix global key support
-- ============================================================

-- STEP 1: Allow course_id to be NULL (required for global keys)
ALTER TABLE enrollment_keys ALTER COLUMN course_id DROP NOT NULL;

-- STEP 2: Add key_type column ('single' or 'global')
ALTER TABLE enrollment_keys ADD COLUMN IF NOT EXISTS key_type text DEFAULT 'single';

-- STEP 3: Add auto_enroll_new_courses column for global keys
ALTER TABLE enrollment_keys ADD COLUMN IF NOT EXISTS auto_enroll_new_courses boolean DEFAULT false;

-- STEP 4: Update the consistency trigger to allow global keys (course_id = NULL)
CREATE OR REPLACE FUNCTION check_enrollment_key_course_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_key_course_id bigint;
    v_key_name text;
BEGIN
    IF NEW.enrollment_key_id IS NOT NULL THEN
        SELECT course_id, key_code INTO v_key_course_id, v_key_name 
        FROM enrollment_keys 
        WHERE id = NEW.enrollment_key_id;

        -- Only enforce match for single-course keys (course_id IS NOT NULL)
        IF v_key_course_id IS NOT NULL AND v_key_course_id != NEW.course_id THEN
            RAISE EXCEPTION 'Course mismatch: Key % is for course %, but attempted enrollment is for course %', 
                v_key_name, v_key_course_id, NEW.course_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_enrollment_key_consistency ON enrollments;
CREATE TRIGGER trigger_check_enrollment_key_consistency
BEFORE INSERT ON enrollments
FOR EACH ROW
EXECUTE FUNCTION check_enrollment_key_course_consistency();

-- STEP 5: Update validate_enrollment_key to handle global keys (course_id = NULL)
CREATE OR REPLACE FUNCTION validate_enrollment_key(p_key_code text)
RETURNS TABLE (
  valid boolean,
  error_message text,
  key_id bigint,
  course_id bigint,
  course_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key enrollment_keys%ROWTYPE;
  v_course_name text;
BEGIN
  SELECT * INTO v_key FROM enrollment_keys WHERE upper(trim(key_code)) = upper(trim(p_key_code));
  
  IF v_key.id IS NULL THEN
    RETURN QUERY SELECT false, 'Invalid enrollment key'::text, NULL::bigint, NULL::bigint, NULL::text;
    RETURN;
  END IF;
  
  IF v_key.is_active = false THEN
    RETURN QUERY SELECT false, 'This enrollment key has been deactivated'::text, NULL::bigint, NULL::bigint, NULL::text;
    RETURN;
  END IF;
  
  IF v_key.valid_from IS NOT NULL AND now() < v_key.valid_from THEN
    RETURN QUERY SELECT false, 'This enrollment key is not yet valid'::text, NULL::bigint, NULL::bigint, NULL::text;
    RETURN;
  END IF;
  
  IF v_key.valid_until IS NOT NULL AND now() > v_key.valid_until THEN
    RETURN QUERY SELECT false, 'This enrollment key has expired'::text, NULL::bigint, NULL::bigint, NULL::text;
    RETURN;
  END IF;
  
  IF v_key.max_uses IS NOT NULL AND v_key.current_uses >= v_key.max_uses THEN
    RETURN QUERY SELECT false, 'This enrollment key has reached its usage limit'::text, NULL::bigint, NULL::bigint, NULL::text;
    RETURN;
  END IF;
  
  -- Global key: course_id IS NULL
  IF v_key.course_id IS NULL THEN
    v_course_name := 'All Courses';
  ELSE
    SELECT name INTO v_course_name FROM courses WHERE id = v_key.course_id;
  END IF;
  
  RETURN QUERY SELECT true, ''::text, v_key.id, v_key.course_id, v_course_name;
END;
$$;

-- STEP 6: Update use_enrollment_key to enroll in all courses for global keys
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

  -- GLOBAL KEY: enroll in all courses not already enrolled
  IF v_validation.course_id IS NULL THEN
    INSERT INTO enrollments (user_id, course_id, enrollment_key_id, enrollment_method)
    SELECT p_user_id, c.id, v_validation.key_id, 'key'
    FROM courses c
    WHERE NOT EXISTS (
      SELECT 1 FROM enrollments e WHERE e.user_id = p_user_id AND e.course_id = c.id
    );

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

-- STEP 7: Auto-enroll existing global key users when a new course is created
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
          );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enroll_global_key_users ON courses;
CREATE TRIGGER trigger_enroll_global_key_users
AFTER INSERT ON courses
FOR EACH ROW
EXECUTE FUNCTION enroll_global_key_users_in_new_course();

-- STEP 8: Auto-delete enrollments when a key is deleted
CREATE OR REPLACE FUNCTION delete_enrollments_on_key_deletion()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM enrollments WHERE enrollment_key_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_delete_enrollments_on_key_deletion ON enrollment_keys;
CREATE TRIGGER trigger_delete_enrollments_on_key_deletion
BEFORE DELETE ON enrollment_keys
FOR EACH ROW
EXECUTE FUNCTION delete_enrollments_on_key_deletion();

-- STEP 9: Replace the FK constraint to use CASCADE instead of SET NULL
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_enrollment_key_id_fkey;
ALTER TABLE enrollments
    ADD CONSTRAINT enrollments_enrollment_key_id_fkey
    FOREIGN KEY (enrollment_key_id)
    REFERENCES enrollment_keys(id)
    ON DELETE CASCADE;

-- Verify everything looks correct
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'enrollment_keys' 
  AND column_name IN ('course_id', 'key_type', 'auto_enroll_new_courses')
ORDER BY column_name;
