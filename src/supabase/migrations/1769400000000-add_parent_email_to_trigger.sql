/* 
# Ensure parent_email column exists 
*/
DO $$
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'parent_email') THEN 
        ALTER TABLE profiles ADD COLUMN parent_email text; 
    END IF;
END $$;

/*
# Update Trigger to include parent_email and update father_mobile
1. Purpose:
   - Ensure the handle_new_user trigger correctly inserts and updates parent_email, father_name, and father_mobile from user metadata.
*/

-- Create robust function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
SECURITY DEFINER 
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
    parent_email,
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
    new.raw_user_meta_data->>'parent_email',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    mobile = COALESCE(EXCLUDED.mobile, public.profiles.mobile),
    father_name = COALESCE(EXCLUDED.father_name, public.profiles.father_name),
    father_mobile = COALESCE(EXCLUDED.father_mobile, public.profiles.father_mobile),
    parent_email = COALESCE(EXCLUDED.parent_email, public.profiles.parent_email);
    
  RETURN new;
END;
$$ LANGUAGE plpgsql;
