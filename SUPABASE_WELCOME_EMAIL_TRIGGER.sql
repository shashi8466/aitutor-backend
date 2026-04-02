-- ============================================
-- SAFE SIGNUP AUTOMATION
-- 1) Ensures profile row is created with student name
-- 2) Queues welcome email on signup
-- ============================================

-- Ensure welcome email queue exists
CREATE TABLE IF NOT EXISTS public.welcome_email_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_at TIMESTAMPTZ,
  payload JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS welcome_email_queue_user_id_unique
ON public.welcome_email_queue(user_id);

CREATE INDEX IF NOT EXISTS idx_welcome_email_status ON public.welcome_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_welcome_email_created ON public.welcome_email_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_welcome_email_processing_at ON public.welcome_email_queue(processing_at);

-- Function: profile + queue in one safe trigger
CREATE OR REPLACE FUNCTION public.handle_signup_profile_and_welcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_role TEXT;
  v_email TEXT;
BEGIN
  v_email := NEW.email;
  
  -- Extract name from raw_user_meta_data (multiple possible locations)
  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'user_name', ''),
    SPLIT_PART(v_email, '@', 1),
    'Student'
  );
  
  -- Extract role with fallback
  v_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'role', ''), 
    'student'
  );

  -- Never fail signup if profile write fails.
  BEGIN
    INSERT INTO public.profiles (id, email, name, role, created_at)
    VALUES (NEW.id, v_email, v_name, v_role, NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(NULLIF(EXCLUDED.name, ''), public.profiles.name),
      role = COALESCE(NULLIF(EXCLUDED.role, ''), public.profiles.role);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Queue welcome email. Never fail signup if queue insert fails.
  BEGIN
    INSERT INTO public.welcome_email_queue (user_id, email, name, status)
    VALUES (NEW.id, v_email, v_name, 'pending')
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(NULLIF(EXCLUDED.name, ''), public.welcome_email_queue.name),
      status = CASE
        WHEN public.welcome_email_queue.status = 'sent' THEN 'sent'
        ELSE 'pending'
      END,
      error_message = NULL,
      processing_at = NULL;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

-- Replace old signup triggers with the unified safe trigger
DROP TRIGGER IF EXISTS on_user_signup_send_welcome ON auth.users;
DROP TRIGGER IF EXISTS on_user_signup_queue_welcome ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_ultra_safe ON auth.users;

CREATE TRIGGER on_auth_user_created_safe
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_signup_profile_and_welcome();

GRANT EXECUTE ON FUNCTION public.handle_signup_profile_and_welcome TO postgres, service_role, authenticated, anon;
GRANT ALL ON public.welcome_email_queue TO postgres, service_role, authenticated, anon;

-- Verification
SELECT
  '✅ Safe signup profile + welcome trigger created' AS status,
  COUNT(*) AS trigger_count
FROM pg_trigger
WHERE tgname = 'on_auth_user_created_safe';
