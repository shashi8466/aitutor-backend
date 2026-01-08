/* 
# Increase Course Content Bucket Size Limit
1. Updates the `course_content` bucket configuration
   - Sets `file_size_limit` to 1GB (1073741824 bytes) to allow larger video uploads.
   - Sets `allowed_mime_types` to NULL to ensure all file types (including various video formats) are accepted.
*/

UPDATE storage.buckets
SET file_size_limit = 1073741824, -- 1GB
    allowed_mime_types = NULL     -- Allow all types
WHERE id = 'course_content';