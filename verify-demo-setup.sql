-- ============================================
-- DEMO API SETUP VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to verify
-- ============================================

-- 1. Check if demo_leads table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_name = 'demo_leads'
        ) 
        THEN '✅ demo_leads table EXISTS'
        ELSE '❌ demo_leads table MISSING - Run migration!'
    END AS table_status;

-- 2. If table exists, check its columns
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'demo_leads'
ORDER BY ordinal_position;

-- 3. Check if courses table has is_demo column
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'courses' AND column_name = 'is_demo'
        ) 
        THEN '✅ courses.is_demo column EXISTS'
        ELSE '❌ courses.is_demo column MISSING - Run migration!'
    END AS column_status;

-- 4. Count existing demo leads (if table exists)
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_name = 'demo_leads'
        ) 
        THEN (SELECT COUNT(*) FROM demo_leads)
        ELSE NULL
    END AS existing_leads_count;

-- 5. Check RLS policies on demo_leads
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'demo_leads';

-- ============================================
-- EXPECTED RESULTS:
-- ============================================
-- ✅ demo_leads table should exist with columns:
--    - id (bigint)
--    - course_id (bigint)
--    - full_name (text)
--    - grade (text)
--    - email (text)
--    - phone (text)
--    - level_completed (text)
--    - score_details (jsonb)
--    - created_at (timestamptz)
--
-- ✅ Should have 2 RLS policies:
--    - "Public can insert demo leads" (INSERT)
--    - "Admins can view demo leads" (SELECT)
-- ============================================
