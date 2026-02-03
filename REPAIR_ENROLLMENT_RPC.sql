
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function repairRpc() {
    console.log("🛠️ Repairing Enrollment RPCs...");
    
    // 1. Fix get_enrollment_key_stats (uses wrong table 'progress')
    // 2. Add SECURITY DEFINER SET search_path = public to all functions
    
    const sql = `
    -- Fix validate_enrollment_key
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
    SET search_path = public
    AS $$
    DECLARE
      v_key enrollment_keys%ROWTYPE;
      v_course_name text;
    BEGIN
      SELECT * INTO v_key FROM enrollment_keys WHERE key_code = p_key_code;
      
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
      
      SELECT name INTO v_course_name FROM courses WHERE id = v_key.course_id;
      
      RETURN QUERY SELECT true, ''::text, v_key.id, v_key.course_id, v_course_name;
    END;
    $$;

    -- Fix use_enrollment_key
    CREATE OR REPLACE FUNCTION use_enrollment_key(p_key_code text, p_user_id uuid)
    RETURNS TABLE (
      success boolean,
      error_message text,
      enrollment_id bigint
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_validation RECORD;
      v_existing_enrollment bigint;
      v_new_enrollment_id bigint;
    BEGIN
      SELECT * INTO v_validation FROM validate_enrollment_key(p_key_code);
      
      IF NOT v_validation.valid THEN
        RETURN QUERY SELECT false, v_validation.error_message, NULL::bigint;
        RETURN;
      END IF;
      
      SELECT id INTO v_existing_enrollment 
      FROM enrollments 
      WHERE user_id = p_user_id AND course_id = v_validation.course_id;
      
      IF v_existing_enrollment IS NOT NULL THEN
        RETURN QUERY SELECT false, 'You are already enrolled in this course'::text, v_existing_enrollment;
        RETURN;
      END IF;
      
      INSERT INTO enrollments (user_id, course_id, enrollment_key_id, enrollment_method)
      VALUES (p_user_id, v_validation.course_id, v_validation.key_id, 'key')
      RETURNING id INTO v_new_enrollment_id;
      
      UPDATE enrollment_keys 
      SET current_uses = current_uses + 1,
          updated_at = now()
      WHERE id = v_validation.key_id;
      
      RETURN QUERY SELECT true, 'Successfully enrolled'::text, v_new_enrollment_id;
    END;
    $$;

    -- Fix get_enrollment_key_stats (progress -> student_progress)
    CREATE OR REPLACE FUNCTION get_enrollment_key_stats(p_key_id bigint)
    RETURNS TABLE (
      total_uses bigint,
      unique_students bigint,
      active_students bigint,
      recent_enrollments jsonb
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        COUNT(e.id)::bigint as total_uses,
        COUNT(DISTINCT e.user_id)::bigint as unique_students,
        COUNT(DISTINCT e.user_id) FILTER (WHERE EXISTS (
          SELECT 1 FROM student_progress p 
          WHERE p.user_id = e.user_id 
          AND p.created_at > now() - interval '30 days'
        ))::bigint as active_students,
        jsonb_agg(
          jsonb_build_object(
            'user_id', e.user_id,
            'name', pr.name,
            'email', pr.email,
            'enrolled_at', e.enrolled_at
          ) ORDER BY e.enrolled_at DESC
        ) FILTER (WHERE e.id IS NOT NULL) as recent_enrollments
      FROM enrollments e
      LEFT JOIN profiles pr ON pr.id = e.user_id
      WHERE e.enrollment_key_id = p_key_id;
    END;
    $$;
    `;

    // Since we don't have a direct SQL executor tool that doesn't require RPC, 
    // we hope the user can run this in Supabase SQL editor.
    // However, I can try to use a dummy table and a trigger to execute it? No.
    // I will write this to a file and tell the user to run it.
}

// Wait, I can't easily run arbitrary SQL from here unless I have a specific RPC.
// But I can try to run it via the Postgres bridge if it exists.
// Actually, I'll just write the SQL fix to a file.
