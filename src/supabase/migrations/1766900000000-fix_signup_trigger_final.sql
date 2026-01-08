/* 
# Fix Signup Trigger & Permissions (Final)
1. Purpose:
   - Ensure `public.profiles` is ALWAYS created when a user signs up.
   - Fix permission issues that might prevent the trigger from writing.
   - Map all potential metadata fields (mobile, father_name, etc.) just in case.
*/

-- 1. Drop existing trigger and function to ensure a clean slate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create a Robust Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
SECURITY DEFINER -- Run as Superuser (bypasses RLS)
SET search_path = public -- Security best practice
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    name,
    role,
    mobile,
    father_name,
    father_mobile,
    created_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'New Student'),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'mobile', -- Optional: Store if passed
    new.raw_user_meta_data->>'father_name', -- Optional: Store if passed
    new.raw_user_meta_data->>'father_mobile', -- Optional: Store if passed
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    role = COALESCE(EXCLUDED.role, public.profiles.role);
    
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach the Trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. CRITICAL: Grant Permissions to the Trigger's Executor
-- The trigger runs as the table owner (usually postgres), but we ensure public/service_role have access too.
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon; -- Allow reading profiles (needed for some checks)