-- ============================================
-- SIMPLE WELCOME EMAIL TRIGGER (No Extensions)
-- Uses Supabase database webhook + backend polling
-- ============================================

-- Create a table to queue welcome emails
CREATE TABLE IF NOT EXISTS welcome_email_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_at TIMESTAMPTZ,
  payload JSONB DEFAULT '{}'
);

-- Hardening for existing deployments (idempotent)
-- 1) Dedupe existing rows to avoid unique-index failures
DELETE FROM welcome_email_queue q
USING (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY
        CASE status
          WHEN 'pending' THEN 1
          WHEN 'processing' THEN 2
          WHEN 'failed' THEN 3
          ELSE 4
        END,
        created_at
    ) AS rn
  FROM welcome_email_queue
  WHERE user_id IS NOT NULL
) d
WHERE q.id = d.id
  AND d.rn > 1;

-- 2) Ensure a single queue row per signup user
CREATE UNIQUE INDEX IF NOT EXISTS welcome_email_queue_user_id_unique
ON welcome_email_queue(user_id);

-- Add `processing_at` if table exists without it yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'welcome_email_queue'
      AND column_name = 'processing_at'
  ) THEN
    ALTER TABLE welcome_email_queue ADD COLUMN processing_at TIMESTAMPTZ;
  END IF;
END $$;

-- Ensure status check allows `processing`
DO $$
BEGIN
  ALTER TABLE welcome_email_queue
    DROP CONSTRAINT IF EXISTS welcome_email_queue_status_check;

  ALTER TABLE welcome_email_queue
    ADD CONSTRAINT welcome_email_queue_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed'));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_welcome_email_status ON welcome_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_welcome_email_created ON welcome_email_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_welcome_email_processing_at ON welcome_email_queue(processing_at);
CREATE INDEX IF NOT EXISTS idx_welcome_email_user ON welcome_email_queue(user_id);

-- Ensure we only run ONE welcome-email mechanism.
-- If the direct webhook trigger exists, it will cause duplicate emails.
DROP TRIGGER IF EXISTS on_user_signup_send_welcome ON auth.users;

-- Function to add new signup to queue
CREATE OR REPLACE FUNCTION queue_welcome_email_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
BEGIN
  -- Extract name from metadata or use email prefix
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1));
  
  -- Insert into queue (fail-safe: never block signup if queue schema changes)
  BEGIN
    INSERT INTO welcome_email_queue (user_id, email, name, status)
    VALUES (NEW.id, NEW.email, user_name, 'pending')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- swallow any queue-related issues so Supabase signup remains stable
    NULL;
  END;
  
  -- Log for debugging
  RAISE NOTICE '📧 Welcome email queued for: %', NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_user_signup_queue_welcome ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_ultra_safe ON auth.users;

-- Create the trigger
CREATE TRIGGER on_user_signup_queue_welcome
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION queue_welcome_email_on_signup();

-- Grant permissions
GRANT EXECUTE ON FUNCTION queue_welcome_email_on_signup TO postgres, anon, authenticated;
GRANT ALL ON welcome_email_queue TO postgres, authenticated, anon;

-- Verification
SELECT 
  '✅ Welcome Email Queue System Created' as status,
  COUNT(*) as trigger_count
FROM pg_trigger 
WHERE tgname = 'on_user_signup_queue_welcome';

-- Check queue table
SELECT 
  'Queue Table Ready' as status,
  COUNT(*) as pending_emails
FROM welcome_email_queue
WHERE status = 'pending';
