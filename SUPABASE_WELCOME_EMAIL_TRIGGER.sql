-- ============================================
-- AUTOMATIC WELCOME EMAIL TRIGGER
-- Sends email when new user signs up
-- ============================================

-- Create or replace the function to send welcome email
CREATE OR REPLACE FUNCTION send_welcome_email_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  -- Variables
  user_email TEXT;
  user_name TEXT;
  user_id TEXT;
BEGIN
  -- Get user details
  user_email := NEW.email;
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(user_email, '@', 1));
  user_id := NEW.id::text;

  -- Log the trigger (for debugging)
  RAISE NOTICE '📧 Sending welcome email to: %', user_email;

  -- Send webhook to backend using Supabase's built-in net.http functions.
  -- Fail-safe: never block signup if webhook fails (network/config/receiver down).
  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.settings.backend_url', true) || '/api/auth/welcome-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )::jsonb,
      body := jsonb_build_object(
        'email', user_email,
        'name', user_name,
        'userId', user_id
      )::jsonb,
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    -- Fail-safe: signup must not return HTTP 500 due to webhook issues.
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_user_signup_send_welcome ON auth.users;
-- Prevent duplicates if the queue-based trigger is enabled too
DROP TRIGGER IF EXISTS on_user_signup_queue_welcome ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_ultra_safe ON auth.users;

-- Create the trigger
CREATE TRIGGER on_user_signup_send_welcome
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION send_welcome_email_on_signup();

-- Grant permissions
GRANT EXECUTE ON FUNCTION send_welcome_email_on_signup TO postgres, anon, authenticated;

-- Verification query
SELECT 
  '✅ Welcome Email Trigger Created' as status,
  COUNT(*) as trigger_count
FROM pg_trigger 
WHERE tgname = 'on_user_signup_send_welcome';
