-- Create welcome email queue table for new user welcome emails
-- Run this in your Supabase SQL Editor

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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_welcome_email_status ON welcome_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_welcome_email_created ON welcome_email_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_welcome_email_user ON welcome_email_queue(user_id);

-- Grant permissions
GRANT ALL ON welcome_email_queue TO postgres, authenticated, anon;

-- Add function to manually add to queue
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
