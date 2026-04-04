-- TABLE: contact_submissions
CREATE TABLE IF NOT EXISTS contact_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    mobile TEXT,
    subject TEXT,
    message TEXT NOT NULL,
    type TEXT, -- 'Contact', 'Support', etc.
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending'
);

-- Enable RLS
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public submissions)
CREATE POLICY "Allow anyone to insert contact submissions" 
ON contact_submissions FOR INSERT 
WITH CHECK (true);

-- Allow admins to view
CREATE POLICY "Allow admins to view contact submissions" 
ON contact_submissions FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
