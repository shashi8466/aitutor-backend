/*
# Force Course Content Bucket to be Public
1. Updates the `course_content` bucket to ensure `public` is set to true.
   - This fixes issues where images uploaded correctly but return 400/403 errors when viewing.
2. Re-applies the Public Read Access policy to be absolutely sure.
*/

-- 1. Force the bucket to be public (Update if it exists)
UPDATE storage.buckets
SET public = true
WHERE id = 'course_content';

-- 2. Ensure the policy exists and is correct (Drop and Recreate)
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;

CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'course_content' );