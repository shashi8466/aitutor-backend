-- ============================================
-- COMPLETE FIX FOR STATUS & PERFORMANCE ISSUES
-- ============================================

-- 1. ADD STATUS COLUMN (if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN status TEXT DEFAULT 'active';
        RAISE NOTICE 'Added status column to profiles table';
    END IF;
END $$;

-- 2. UPDATE ALL EXISTING USERS TO ACTIVE
UPDATE public.profiles 
SET status = 'active' 
WHERE status IS NULL;

-- 3. ADD PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 4. ENSURE PROPER PERMISSIONS
GRANT ALL ON public.profiles TO postgres, authenticated, anon;
GRANT SELECT ON public.profiles TO anon;

-- 5. VERIFICATION QUERY
SELECT 
    '✅ Profiles table optimized' as status,
    COUNT(*) as total_users,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
    COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_users,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
    COUNT(CASE WHEN role = 'parent' THEN 1 END) as parent_users,
    COUNT(CASE WHEN role = 'student' THEN 1 END) as student_users
FROM public.profiles;

-- 6. SAMPLE DATA CHECK
SELECT 
    id,
    email,
    name,
    role,
    status,
    created_at,
    updated_at
FROM public.profiles 
WHERE role IN ('admin', 'parent', 'student')
ORDER BY created_at DESC
LIMIT 10;
