-- Update use_enrollment_key to be more strict with course binding
CREATE OR REPLACE FUNCTION use_enrollment_key(p_key_code text, p_user_id uuid, p_intended_course_id bigint DEFAULT NULL)
RETURNS TABLE (
  success boolean,
  error_message text,
  enrollment_id bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS 
DECLARE
  v_validation RECORD;
  v_existing_enrollment bigint;
  v_new_enrollment_id bigint;
BEGIN
  -- Validate the key
  SELECT * INTO v_validation FROM validate_enrollment_key(p_key_code);
  
  IF NOT v_validation.valid THEN
    RETURN QUERY SELECT false, v_validation.error_message, NULL::bigint;
    RETURN;
  END IF;

  -- ?? STRICT BINDING CHECK: If an intended course is provided, it MUST match the key
  IF p_intended_course_id IS NOT NULL AND v_validation.course_id != p_intended_course_id THEN
    RETURN QUERY SELECT false, 'This enrollment key is for a different course (' || v_validation.course_name || ').'::text, NULL::bigint;
    RETURN;
  END IF;
  
  -- Check if user is already enrolled
  SELECT id INTO v_existing_enrollment 
  FROM enrollments 
  WHERE user_id = p_user_id AND course_id = v_validation.course_id;
  
  IF v_existing_enrollment IS NOT NULL THEN
    RETURN QUERY SELECT false, 'You are already enrolled in ' || v_validation.course_name::text, v_existing_enrollment;
    RETURN;
  END IF;
  
  -- Create enrollment
  INSERT INTO enrollments (user_id, course_id, enrollment_key_id, enrollment_method)
  VALUES (p_user_id, v_validation.course_id, v_validation.key_id, 'key')
  RETURNING id INTO v_new_enrollment_id;
  
  -- Increment key usage count
  UPDATE enrollment_keys 
  SET current_uses = current_uses + 1,
      updated_at = now()
  WHERE id = v_validation.key_id;
  
  RETURN QUERY SELECT true, 'Successfully enrolled in ' || v_validation.course_name::text, v_new_enrollment_id;
END;
;
