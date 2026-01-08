/* 
# FORCE Fix Course Content Bucket Limits
1. Uses INSERT ... ON CONFLICT to ensure the bucket exists.
2. Sets `file_size_limit` to NULL (Unlimited).
3. Sets `allowed_mime_types` to NULL (All types).
4. Ensures `public` is true.

This fixes the issue where the bucket was created with default 50MB limits by the app, missing the previous update.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course_content', 
  'course_content', 
  true, 
  NULL, -- NULL means Unlimited size
  NULL  -- NULL means All MIME types
)
ON CONFLICT (id) DO UPDATE
SET 
  public = true,
  file_size_limit = NULL,
  allowed_mime_types = NULL;