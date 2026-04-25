-- Final Enforcement: Database-level Constraint Trigger
-- This ensures that NO MATTER HOW a student is enrolled (Backend, RPC, or Direct API),
-- if they use an enrollment key, it MUST match the intended course.

CREATE OR REPLACE FUNCTION check_enrollment_key_course_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_key_course_id bigint;
    v_key_name text;
BEGIN
    -- Only check if an enrollment key was used
    IF NEW.enrollment_key_id IS NOT NULL THEN
        -- Get the course_id the key was intended for
        SELECT course_id, key_code INTO v_key_course_id, v_key_name 
        FROM enrollment_keys 
        WHERE id = NEW.enrollment_key_id;

        -- Check for mismatch
        IF v_key_course_id != NEW.course_id THEN
            RAISE EXCEPTION 'Course mismatch: Key % is for course %, but attempted enrollment is for course %', 
                v_key_name, v_key_course_id, NEW.course_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to enrollments table
DROP TRIGGER IF EXISTS trigger_check_enrollment_key_consistency ON enrollments;
CREATE TRIGGER trigger_check_enrollment_key_consistency
BEFORE INSERT ON enrollments
FOR EACH ROW
EXECUTE FUNCTION check_enrollment_key_course_consistency();

-- Also update the RPC function one last time to be extra robust
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
  -- Strict input cleaning
  p_key_code := trim(upper(p_key_code));

  -- Validate the key basics (active, uses, expiry)
  SELECT * INTO v_validation FROM validate_enrollment_key(p_key_code);
  
  IF NOT v_validation.valid THEN
    RETURN QUERY SELECT false, v_validation.error_message, NULL::bigint;
    RETURN;
  END IF;

  -- 🎯 CRITICAL: Strict Binding Check
  -- If we know which course the student is on, it MUST match the key's course.
  IF p_intended_course_id IS NOT NULL AND v_validation.course_id != p_intended_course_id THEN
    RETURN QUERY SELECT false, 'This enrollment key is for ' || v_validation.course_name || ' and cannot be used here.'::text, NULL::bigint;
    RETURN;
  END IF;
  
  -- Secondary check: Does the user ALREADY have any enrollment in the course the key is for?
  SELECT id INTO v_existing_enrollment 
  FROM enrollments 
  WHERE user_id = p_user_id AND course_id = v_validation.course_id;
  
  IF v_existing_enrollment IS NOT NULL THEN
    RETURN QUERY SELECT false, 'You are already enrolled in ' || v_validation.course_name::text, v_existing_enrollment;
    RETURN;
  END IF;
  
  -- Final Check: Ensure p_user_id is valid
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN QUERY SELECT false, 'User profile not found'::text, NULL::bigint;
    RETURN;
  END IF;

  -- Perform enrollment
  INSERT INTO enrollments (user_id, course_id, enrollment_key_id, enrollment_method)
  VALUES (p_user_id, v_validation.course_id, v_validation.key_id, 'key')
  RETURNING id INTO v_new_enrollment_id;
  
  -- Increment usage
  UPDATE enrollment_keys 
  SET current_uses = current_uses + 1,
      updated_at = now()
  WHERE id = v_validation.key_id;
  
  RETURN QUERY SELECT true, 'Successfully enrolled in ' || v_validation.course_name::text, v_new_enrollment_id;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, SQLERRM, NULL::bigint;
END;
$$;
