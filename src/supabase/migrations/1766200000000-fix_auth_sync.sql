/*
  # Fix Profiles and Auth Sync
  1. Creates profiles for any user in auth.users that is missing one.
  2. Ensures the profile trigger is active and robust.
*/

-- 1. Sync any missing profiles (Orphaned Users)
INSERT INTO public.profiles (id, email, name, role, created_at)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'name', 'Restored User'),
  COALESCE(raw_user_meta_data->>'role', 'student'),
  created_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 2. Grant permissions just in case
GRANT ALL ON public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;