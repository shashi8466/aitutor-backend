-- Add metadata column to test_submissions for adaptive test analytics
ALTER TABLE test_submissions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
