-- ============================================
-- COMPLETE STATUS FIX - ADMIN CONTROL ONLY
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

-- 2. FORCE ALL EXISTING USERS TO 'ACTIVE' (admin control only)
UPDATE public.profiles 
SET status = 'active' 
WHERE status IS NULL OR status != 'active';

-- 3. ENSURE ALL PARENTS AND STUDENTS ARE ACTIVE
UPDATE public.profiles 
SET status = 'active' 
WHERE role IN ('parent', 'student') AND status != 'active';

-- 4. ADD PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, status);

-- 5. VERIFICATION - SHOW CURRENT STATUS
SELECT 
    role,
    status,
    COUNT(*) as user_count,
    STRING_AGG(email, ', ' ORDER BY email) as sample_emails
FROM public.profiles 
WHERE role IN ('admin', 'parent', 'student', 'tutor')
GROUP BY role, status
ORDER BY role, status;

-- 6. DETAILED STATUS CHECK
SELECT 
    id,
    email,
    name,
    role,
    status,
    created_at,
    updated_at
FROM public.profiles 
WHERE role IN ('parent', 'student')
ORDER BY role, created_at DESC
LIMIT 10;

-- 7. ADMIN STATUS SUMMARY
SELECT 
    '✅ Status Fix Complete' as status,
    COUNT(*) as total_users,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
    COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_users,
    COUNT(CASE WHEN role = 'parent' THEN 1 END) as parent_count,
    COUNT(CASE WHEN role = 'student' THEN 1 END) as student_count
FROM public.profiles
WHERE role IN ('parent', 'student', 'admin', 'tutor');
