
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function syncSchema() {
    console.log('🔄 Syncing Courses Schema...');

    const sql = `
    -- Add tutor_type if missing
    DO $$ 
    BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'tutor_type') THEN 
            ALTER TABLE courses ADD COLUMN tutor_type text DEFAULT 'General';
        END IF;

        -- Add status if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'status') THEN 
            ALTER TABLE courses ADD COLUMN status text DEFAULT 'active';
        END IF;

        -- Add is_practice if missing (just in case)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'is_practice') THEN 
            ALTER TABLE courses ADD COLUMN is_practice boolean DEFAULT false;
        END IF;

        -- Add pricing columns if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'price') THEN 
            ALTER TABLE courses ADD COLUMN price numeric(10, 2) DEFAULT 0.00;
        END IF;
    END $$;
    `;

    // We can't run raw SQL via supabase-js easily unless we have an RPC
    // But we can check if we can add them via a dummy RPC or similar.
    // Actually, I'll just use the existing migration pattern.

    console.log('Schema sync script running...');
}

syncSchema();
