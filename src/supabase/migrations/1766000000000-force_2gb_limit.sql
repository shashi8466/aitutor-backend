/*
  # Force 2GB Upload Limit
  1. Updates the `course_content` bucket to explicitly allow files up to 2GB.
  2. Sets `allowed_mime_types` to NULL (allows all types).
  3. Ensures the bucket is public.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course_content', 
  'course_content', 
  true, 
  2147483648, -- 2GB in bytes
  NULL
)
ON CONFLICT (id) DO UPDATE
SET 
  public = true, 
  file_size_limit = 2147483648, 
  allowed_mime_types = NULL;