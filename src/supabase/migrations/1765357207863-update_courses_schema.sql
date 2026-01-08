/* 
# Update Courses Table Schema
1. New Columns
   - `tutor_type` (text) - e.g., 'SAT Math', 'Python'
   - `price_full` (numeric) - Price for full package
   - `price_section_a` (numeric) - Price for Section A
   - `price_section_b` (numeric) - Price for Section B
   - `status` (text) - Ensuring default is 'active'
*/

DO $$ 
BEGIN 
    -- Add tutor_type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'tutor_type') THEN
        ALTER TABLE courses ADD COLUMN tutor_type text DEFAULT 'General';
    END IF;

    -- Add pricing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'price_full') THEN
        ALTER TABLE courses ADD COLUMN price_full numeric(10, 2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'price_section_a') THEN
        ALTER TABLE courses ADD COLUMN price_section_a numeric(10, 2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'price_section_b') THEN
        ALTER TABLE courses ADD COLUMN price_section_b numeric(10, 2) DEFAULT 0.00;
    END IF;
END $$;