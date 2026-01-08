/* 
# Fix Courses Schema
1. Changes
   - Ensures `tutor_type`, `price_full`, `price_section_a`, `price_section_b` columns exist.
   - Sets correct defaults for pricing.
   - Ensures `status` column exists.
*/

DO $$ 
BEGIN 
    -- Add tutor_type if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'tutor_type') THEN 
        ALTER TABLE courses ADD COLUMN tutor_type text DEFAULT 'General';
    END IF;

    -- Add status if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'status') THEN 
        ALTER TABLE courses ADD COLUMN status text DEFAULT 'active';
    END IF;

    -- Add pricing columns with numeric type
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