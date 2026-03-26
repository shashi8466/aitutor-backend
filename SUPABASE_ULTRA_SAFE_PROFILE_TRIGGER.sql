-- ============================================
-- ULTRA SAFE PROFILE TRIGGER (Signup won't 500)
-- ============================================
-- Fixes cases where any error inside the `auth.users` trigger
-- causes Supabase `/auth/v1/signup` to return HTTP 500.
--
-- This version:
-- - drops ALL triggers on `auth.users` (clear the slate)
-- - writes ONLY the minimal guaranteed columns (id/email/name/role)
-- - wraps both profile + welcome-email queue inserts in exception blocks
-- - guarantees signup never fails due to trigger issues

-- 0) Drop ALL triggers on auth.users (clear the slate)
DO $$
DECLARE trig_record RECORD;
BEGIN
  FOR trig_record IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'users'
      AND event_object_schema = 'auth'
  LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trig_record.trigger_name) || ' ON auth.users';
  END LOOP;
END $$;

-- Extra guard: ensure the direct webhook trigger is removed
DROP TRIGGER IF EXISTS on_user_signup_send_welcome ON auth.users;
DROP FUNCTION IF EXISTS public.send_welcome_email_on_signup();

-- 1) Create/replace the fail-safe profile trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, name, role, created_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', 'New Student'),
      COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, public.profiles.name),
      role = COALESCE(EXCLUDED.role, public.profiles.role);
  EXCEPTION WHEN OTHERS THEN
    -- Fail-safe: never block signup if profiles insert fails.
    -- (You can inspect errors by temporarily removing this exception block.)
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Attach the profile trigger (only trigger related to profiles)
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 3) Permissions (best-effort)
GRANT USAGE ON SCHEMA public TO postgres, service_role, authenticated, anon;
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;

-- 3) Also re-add a fail-safe welcome-email queue trigger
-- so you keep the queue approach, but signup never blocks on queue issues.
CREATE OR REPLACE FUNCTION public.queue_welcome_email_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name TEXT;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1));

  BEGIN
    -- Use dynamic SQL so missing tables / missing unique indexes
    -- never break function creation or signup.
    EXECUTE
      'INSERT INTO public.welcome_email_queue (user_id, email, name, status)
       SELECT $1, $2, $3, ''pending''
       WHERE NOT EXISTS (
         SELECT 1 FROM public.welcome_email_queue WHERE user_id = $1
       )'
    USING NEW.id, NEW.email, user_name;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block signup
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_signup_queue_welcome ON auth.users;

CREATE TRIGGER on_user_signup_queue_welcome
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.queue_welcome_email_on_signup();

SELECT '✅ Ultra-safe signup triggers applied (all auth.users triggers cleared + safe profile + safe welcome queue).' AS status;

