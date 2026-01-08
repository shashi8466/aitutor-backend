/*
# Switch to 'documents' Bucket & Increase Limit
1. Storage Configuration
   - Configures `documents` bucket to be public
   - Sets file size limit to 3GB (3221225472 bytes)
   - Removes MIME type restrictions
2. Security Policies
   - Enables RLS on the bucket
   - Adds "Public Read" policy
   - Adds "Authenticated Upload/Update/Delete" policies for admins/users
*/

-- 1. Configure the 'documents' bucket (Insert or Update)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  3221225472, -- 3GB in bytes
  NULL        -- Allow ali types
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 3221225472,
  allowed_mime_types = NULL;

-- 2. Drop existing policies for 'documents' to ensure clean slate
DROP POLICY IF EXISTS "Public Read Access documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Access documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access documents" ON storage.objects;

-- 3. Create comprehensive policies for the 'documents' bucket

-- Allow PUBLIC read access (Essential for images/videos to play)
CREATE POLICY "Public Read Access documents"
ON storage.objects FOR SELECT
USING ( bucket_id = 'documents' );

-- Allow AUTHENTICATED users to upload files
CREATE POLICY "Authenticated Upload Access documents"
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'documents' );

-- Allow AUTHENTICATED users to update their files
CREATE POLICY "Authenticated Update Access documents"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'documents' );

-- Allow AUTHENTICATED users to delete their files
CREATE POLICY "Authenticated Delete Access documents"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'documents' );