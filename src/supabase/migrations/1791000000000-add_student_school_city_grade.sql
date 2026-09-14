/*
# Add school_name, city_state, grade columns to profiles
Backs the updated Student Sign-Up form (school name, combined city/state,
grade), collected alongside the existing father_name/father_mobile/parent_email
guardian columns.
*/
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'school_name') THEN
    ALTER TABLE profiles ADD COLUMN school_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'city_state') THEN
    ALTER TABLE profiles ADD COLUMN city_state text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'grade') THEN
    ALTER TABLE profiles ADD COLUMN grade text;
  END IF;
END $$;

-- Update the signup trigger to also persist school_name/city_state/grade from user metadata.
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
    school_name,
    city_state,
    grade,
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
    new.raw_user_meta_data->>'schoolName',
    new.raw_user_meta_data->>'cityState',
    new.raw_user_meta_data->>'grade',
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
    school_name = COALESCE(EXCLUDED.school_name, public.profiles.school_name),
    city_state = COALESCE(EXCLUDED.city_state, public.profiles.city_state),
    grade = COALESCE(EXCLUDED.grade, public.profiles.grade),
    father_name = COALESCE(EXCLUDED.father_name, public.profiles.father_name),
    father_mobile = COALESCE(EXCLUDED.father_mobile, public.profiles.father_mobile),
    parent_email = COALESCE(EXCLUDED.parent_email, public.profiles.parent_email);

  RETURN new;
END;
$$ LANGUAGE plpgsql;
