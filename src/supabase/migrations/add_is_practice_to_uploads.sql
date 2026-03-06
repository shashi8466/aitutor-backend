/*
# Add is_practice column to uploads table
*/

ALTER TABLE uploads ADD COLUMN IF NOT EXISTS is_practice boolean DEFAULT false;
