-- ============================================
-- ADD STATUS COLUMN TO PROFILES TABLE
-- ============================================

-- Add status column to profiles table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN status TEXT DEFAULT 'active';
            
        RAISE NOTICE 'Added status column to profiles table with default value "active"';
    END IF;
END $$;

-- Add check constraint for valid status values (separate statement)
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_status_check 
CHECK (status IN ('active', 'inactive', 'suspended', 'pending'));

-- Update existing records to have active status (only affects NULL records)
UPDATE public.profiles 
SET status = 'active' 
WHERE status IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- Grant permissions
GRANT ALL ON public.profiles TO postgres, authenticated, anon;

-- Verification
SELECT 
    '✅ Status column added to profiles table' as status,
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_profiles,
    COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_profiles
FROM public.profiles;

-- Sample data check (optional)
SELECT 
    id, 
    email, 
    name, 
    role, 
    status, 
    created_at
FROM public.profiles 
WHERE role IN ('parent', 'student', 'admin', 'tutor')
ORDER BY created_at DESC
LIMIT 5;
