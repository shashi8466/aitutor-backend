-- Update contact_messages table to support new requirements
-- This script adds missing columns and fixes RLS

-- 1. Add missing columns (if they don't exist)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_messages' AND column_name='subject') THEN
        ALTER TABLE contact_messages ADD COLUMN subject TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_messages' AND column_name='type') THEN
        ALTER TABLE contact_messages ADD COLUMN type TEXT DEFAULT 'Support';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_messages' AND column_name='metadata') THEN
        ALTER TABLE contact_messages ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Ensure RLS is enabled
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Anyone can insert (for contact forms)
DROP POLICY IF EXISTS "Allow public to insert contact messages" ON contact_messages;
CREATE POLICY "Allow public to insert contact messages" 
ON contact_messages FOR INSERT 
WITH CHECK (true);

-- 4. Policy: Admins can view all messages
DROP POLICY IF EXISTS "Allow admins to view contact messages" ON contact_messages;
CREATE POLICY "Allow admins to view contact messages" 
ON contact_messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
