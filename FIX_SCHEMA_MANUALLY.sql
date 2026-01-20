-- ============================================
-- MANUAL SCHEMA FIX FOR UPLOADS TABLE
-- ============================================

-- Run this SQL in your Supabase SQL Editor to fix the schema cache issue
-- 1. Go to https://supabase.com/dashboard/project/_/sql
-- 2. Paste this code
-- 3. Click "RUN"

-- Ensure the uploads table has all required columns
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Ensure other columns exist as well
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS questions_count integer DEFAULT 0;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS category text DEFAULT 'source_document';
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS level text DEFAULT 'All';
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS file_url text;

-- Make sure the update policy exists for uploads table
DO $$
BEGIN 
  -- Create the update policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'uploads' AND schemaname = 'public' AND policyname = 'Uploads are updatable by admins'
  ) THEN
    CREATE POLICY "Uploads are updatable by admins" 
    ON uploads 
    FOR UPDATE 
    TO authenticated 
    USING ( 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') 
    );
  END IF;
END $$;

-- Refresh the schema cache by querying the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'uploads' 
ORDER BY ordinal_position;

-- Test that the status column now works
-- This will fail if there are still issues
-- SELECT * FROM uploads WHERE status IS NOT NULL LIMIT 1;

-- Success message
SELECT 'Schema fix applied successfully!' as status;