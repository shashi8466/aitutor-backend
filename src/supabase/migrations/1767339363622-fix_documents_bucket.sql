/*
# Fix Documents Bucket & Limits
1. Storage Configuration
   - Ensures `documents` bucket exists
   - Sets file size limit to 3GB
   - Sets public access to TRUE
2. Security
   - Re-applies public read policies
   - Re-applies authenticated upload policies
*/

-- 1. Create/Update 'documents' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  3221225472, -- 3GB in bytes
  NULL        -- Allow all MIME types
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 3221225472,
  allowed_mime_types = NULL;

-- 2. Drop old policies to prevent conflicts
DROP POLICY IF EXISTS "Public Read Access documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Access documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access documents" ON storage.objects;

-- 3. Create policies
-- Public Read (Crucial for viewing files)
CREATE POLICY "Public Read Access documents"
ON storage.objects FOR SELECT
USING ( bucket_id = 'documents' );

-- Authenticated Upload
CREATE POLICY "Authenticated Upload Access documents"
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'documents' );

-- Authenticated Update
CREATE POLICY "Authenticated Update Access documents"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'documents' );

-- Authenticated Delete
CREATE POLICY "Authenticated Delete Access documents"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'documents' );