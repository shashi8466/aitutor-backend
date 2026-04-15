/* 
# Add Main Category to Courses
1. New Column
   - `main_category` (text) - e.g., 'SAT', 'ACT', 'AP'
*/

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'main_category') THEN
        ALTER TABLE courses ADD COLUMN main_category text;
    END IF;
END $$;

-- Update existing courses based on tutor_type
UPDATE courses SET main_category = 'SAT' WHERE tutor_type IN ('SAT Math', 'SAT Reading and Writing', 'SAT Reading & Writing');
UPDATE courses SET main_category = 'AP' WHERE tutor_type IN ('Science', 'AP Physics', 'AP Chemistry', 'AP Biology', 'AP Pre-Calculus', 'Algebra 1', 'Algebra 2', 'Geometry');
UPDATE courses SET main_category = 'ACT' WHERE tutor_type IN ('ACT Math', 'ACT English', 'ACT Science');
UPDATE courses SET main_category = 'SAT' WHERE main_category IS NULL; -- Default fallback
