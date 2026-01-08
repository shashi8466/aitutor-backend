/* 
# Ultimate Signup Fix
1. Purpose:
   - Ensure all profile columns exist (`mobile`, `father_name`, etc.).
   - Re-create the `handle_new_user` trigger with SUPERUSER permissions (`SECURITY DEFINER`).
   - Grant explicit access to `postgres` and `service_role` to prevent RLS blocks.
*/

-- 1. Ensure Columns Exist (Idempotent)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'mobile') THEN 
        ALTER TABLE profiles ADD COLUMN mobile text; 
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'father_name') THEN 
        ALTER TABLE profiles ADD COLUMN father_name text; 
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'father_mobile') THEN 
        ALTER TABLE profiles ADD COLUMN father_mobile text; 
    END IF;
END $$;

-- 2. Drop Old Trigger/Function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Create Robust Function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
SECURITY DEFINER -- Runs as Superuser
SET search_path = public
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
    new.raw_user_meta_data->>'mobile',
    new.raw_user_meta_data->>'father_name',
    new.raw_user_meta_data->>'father_mobile',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    mobile = COALESCE(EXCLUDED.mobile, public.profiles.mobile),
    father_name = COALESCE(EXCLUDED.father_name, public.profiles.father_name);
    
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach Trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Grant Permissions (The Nuclear Option for Permissions)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;