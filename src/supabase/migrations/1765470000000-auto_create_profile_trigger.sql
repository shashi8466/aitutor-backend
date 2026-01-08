/* 
# Auto-Create Profile Trigger
1. Automation
   - Creates a server-side trigger to automatically create a user profile when a new user signs up.
   - This fixes the "profile not stored" issue caused by RLS policies blocking unconfirmed users.
   - Pulls `name` and `role` directly from the signup metadata.
*/

-- 1. Create the function that runs on new user insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    COALESCE(new.raw_user_meta_data->>'role', 'student')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to the auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();