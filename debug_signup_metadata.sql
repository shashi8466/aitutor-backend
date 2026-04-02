-- ============================================
-- DEBUG SIGNUP METADATA EXTRACTION
-- Run this to check what's happening with signup data
-- ============================================

-- Check recent auth.users with metadata
SELECT 
  id,
  email,
  created_at,
  raw_user_meta_data,
  raw_user_meta_data->>'name' as name_in_metadata,
  raw_user_meta_data->>'full_name' as full_name_in_metadata,
  raw_user_meta_data->>'role' as role_in_metadata
FROM auth.users 
WHERE email = 'nagabalaanusha@gmail.com'
ORDER BY created_at DESC
LIMIT 5;

-- Check if profile was created
SELECT 
  id,
  email,
  name,
  role,
  created_at
FROM public.profiles 
WHERE email = 'nagabalaanusha@gmail.com'
ORDER BY created_at DESC
LIMIT 5;

-- Check if welcome email was queued
SELECT 
  user_id,
  email,
  name,
  status,
  created_at,
  error_message
FROM public.welcome_email_queue 
WHERE email = 'nagabalaanusha@gmail.com'
ORDER BY created_at DESC
LIMIT 5;

-- Check trigger exists
SELECT 
  tgname,
  tgenabled,
  tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created_safe';

-- Test the function directly (optional)
-- SELECT public.handle_signup_profile_and_welcome();
