/*
# Fix Storage Policies for Course Content
1. Storage Bucket
   - Ensures `course_content` bucket exists and is public
2. Security Policies
   - Enables RLS on storage objects
   - Adds "Public Read Access" policy so images load in quizzes
   - Adds "Authenticated Upload/Update/Delete" policies so admins can manage files
*/

-- 1. Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('course_content', 'course_content', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to avoid conflicts and ensure clean slate
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;

-- 3. Create comprehensive policies for the 'course_content' bucket

-- Allow PUBLIC read access (Essential for images to display in the app)
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'course_content' );

-- Allow AUTHENTICATED users (Admins/Students) to upload files
CREATE POLICY "Authenticated Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'course_content' );

-- Allow AUTHENTICATED users to update their files
CREATE POLICY "Authenticated Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'course_content' );

-- Allow AUTHENTICATED users to delete their files
CREATE POLICY "Authenticated Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'course_content' );