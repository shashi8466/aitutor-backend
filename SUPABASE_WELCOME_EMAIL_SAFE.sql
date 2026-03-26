-- ============================================
-- SAFE WELCOME EMAIL SETUP (No Triggers)
-- Manual queue-based approach - won't break signup
-- ============================================

-- Create the welcome email queue table
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

-- Schema hardening for existing deployments (idempotent)
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

-- 3) Add missing columns if they don't exist yet
DO $$
BEGIN
  -- Add processing_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'welcome_email_queue' AND column_name = 'processing_at'
  ) THEN
    ALTER TABLE welcome_email_queue ADD COLUMN processing_at TIMESTAMPTZ;
  END IF;

  -- Add payload
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'welcome_email_queue' AND column_name = 'payload'
  ) THEN
    ALTER TABLE welcome_email_queue ADD COLUMN payload JSONB DEFAULT '{}';
  END IF;
END $$;

-- 4) Expand status check constraint to include `processing`
-- Postgres auto-generated names typically match this convention.
DO $$
BEGIN
  ALTER TABLE welcome_email_queue
    DROP CONSTRAINT IF EXISTS welcome_email_queue_status_check;
EXCEPTION
  WHEN undefined_object THEN
    -- ignore
  WHEN others THEN
    -- ignore and let next statement handle if already compatible
    NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE welcome_email_queue
    ADD CONSTRAINT welcome_email_queue_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed'));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_welcome_email_status ON welcome_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_welcome_email_created ON welcome_email_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_welcome_email_user ON welcome_email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_welcome_email_processing_at ON welcome_email_queue(processing_at);

-- Grant permissions (important!)
GRANT ALL ON welcome_email_queue TO postgres, authenticated, anon;

-- Add a simple function to manually add to queue (optional, for testing)
CREATE OR REPLACE FUNCTION add_to_welcome_queue(user_email TEXT, user_name TEXT, user_id UUID DEFAULT NULL)
RETURNS BIGINT AS $$
DECLARE
  new_id BIGINT;
BEGIN
  INSERT INTO welcome_email_queue (user_id, email, name, status)
  VALUES (user_id, user_email, user_name, 'pending')
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION add_to_welcome_queue TO postgres, authenticated, anon;

-- Verification
SELECT 
  '✅ Welcome Email Queue Table Created' as status,
  COUNT(*) as total_records
FROM welcome_email_queue;

-- Show table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'welcome_email_queue'
ORDER BY ordinal_position;
