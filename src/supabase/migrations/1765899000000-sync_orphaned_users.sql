/* 
# Sync Orphaned Auth Users
1. Purpose
   - Detects users who exist in the hidden `auth.users` table but are missing from `public.profiles`.
   - Restores their profile row so they can log in successfully.
   
2. Instructions
   - Run this query in your Supabase SQL Editor to fix the immediate issue.
   - It will insert the missing row for 'shashikumaredula@gmail.com'.
*/

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