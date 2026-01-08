/* 
# Add Manual Enrollment Count
1. New Columns
   - `manual_enrollment_count` (integer) on `courses` table.
     - Default: 0
     - Used for displaying "marketing" enrollment numbers editable by admin.
*/

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'manual_enrollment_count') THEN 
    ALTER TABLE courses ADD COLUMN manual_enrollment_count integer DEFAULT 0; 
  END IF;
END $$;