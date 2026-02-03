
-- ==========================================================
-- 🛠️ SUPER FIX: UNBLOCK USER DELETION
-- ==========================================================
-- This script ensures that when you delete a user from the 
-- Supabase Auth dashboard, all their associated data (profiles, 
-- tests, tasks, etc.) is automatically deleted.
--
-- 🚀 INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard
-- 2. Click on "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Paste this entire script and click "RUN"
-- ==========================================================

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- This loops through all tables that reference 'profiles' or 'auth.users' 
    -- and ensures they have ON DELETE CASCADE set.
    
    FOR r IN (
        SELECT 
            tc.table_schema, 
            tc.table_name, 
            kcu.column_name, 
            con.conname as constraint_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN pg_constraint con ON con.conname = tc.constraint_name
            JOIN pg_class cl ON cl.oid = con.confrelid
        WHERE 
            tc.constraint_type = 'FOREIGN KEY' 
            AND (cl.relname = 'profiles' OR cl.relname = 'users') -- Check references to profiles or auth.users
            AND tc.table_schema = 'public'
    ) LOOP
        -- Drop the existing constraint and recreate it with ON DELETE CASCADE
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.table_schema, r.table_name, r.constraint_name);
        
        IF (r.table_name = 'profiles') THEN
            -- Profiles special case: references auth.users
            EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE', 
                r.table_schema, r.table_name, r.constraint_name, r.column_name);
        ELSE
            -- Other tables: reference profiles(id)
            EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE CASCADE', 
                r.table_schema, r.table_name, r.constraint_name, r.column_name);
        END IF;
        
        RAISE NOTICE '✅ Fixed table: %', r.table_name;
    END LOOP;
END $$;

-- Specifically ensure study_tasks is handled (often missed)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'study_tasks') THEN
        ALTER TABLE study_tasks DROP CONSTRAINT IF EXISTS study_tasks_user_id_fkey;
        ALTER TABLE study_tasks ADD CONSTRAINT study_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Fixed table: study_tasks';
    END IF;
END $$;
