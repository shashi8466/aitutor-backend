/* 
# Repair Signup Trigger & Permissions
1. Rebuilds the `handle_new_user` trigger to be bulletproof.
2. Ensures `public.profiles` has correct permissions for the trigger to write to it.
3. Adds a fallback policy to ensure new users can always be inserted.
*/

-- 1. Drop existing trigger to ensure clean slate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Redefine the function with maximum privileges (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    -- Handle missing metadata gracefully
    COALESCE(new.raw_user_meta_data->>'name', 'New Student'),
    COALESCE(new.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO UPDATE SET
    -- If profile exists but is incomplete, update it
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name);
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Re-attach trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. CRITICAL: Grant permissions to the postgres role (which executes the trigger)
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON public.profiles TO postgres;
GRANT ALL ON public.profiles TO service_role;

-- 5. Ensure Authenticated users can insert their own profile (Client-side fallback)
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);