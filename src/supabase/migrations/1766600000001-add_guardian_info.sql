/* 
# Add Guardian Info to Profiles
1. New Columns
   - `father_name` (text)
   - `father_mobile` (text)
   - `mobile` (text) - Ensure it exists
2. Purpose
   - Store parent/guardian details collected during enrollment.
*/

DO $$ 
BEGIN 
    -- Add father_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'father_name') THEN 
        ALTER TABLE profiles ADD COLUMN father_name text; 
    END IF;

    -- Add father_mobile
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'father_mobile') THEN 
        ALTER TABLE profiles ADD COLUMN father_mobile text; 
    END IF;

    -- Add mobile (student's mobile) if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'mobile') THEN 
        ALTER TABLE profiles ADD COLUMN mobile text; 
    END IF;
END $$;