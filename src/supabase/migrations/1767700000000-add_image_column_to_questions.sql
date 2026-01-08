/* 
# Add Image Column to Questions Table
1. Purpose:
   - Add an image column to store image URLs for questions
   - This allows questions to have associated images that display in the quiz
*/

-- Add image column to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image TEXT;

-- Update RLS policies to allow authenticated users to read the image column
-- (The existing policies already allow SELECT on the whole table)