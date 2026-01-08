/* 
# Add Upload ID to Questions
1. Changes
   - Add `upload_id` column to `questions` table
   - Foreign key to `uploads.id` with CASCADE delete
   - This allows linking questions to specific file uploads
*/

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS upload_id bigint REFERENCES uploads(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_questions_upload_id ON questions(upload_id);