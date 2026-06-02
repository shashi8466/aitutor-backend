CREATE OR REPLACE FUNCTION public.handle_new_user() 
  RETURNS trigger 
  SECURITY DEFINER 
  SET search_path = public
  AS $$
  BEGIN
    INSERT INTO public.profiles (
      id, email, name, role, mobile,
      father_name, father_mobile, parent_email,
      created_at
    )
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'name', 'New Student'),
      COALESCE(new.raw_user_meta_data->>'role', 'student'),
      new.raw_user_meta_data->>'mobile',
      COALESCE(new.raw_user_meta_data->>'father_name', new.raw_user_meta_data->>'parentName'),
      COALESCE(new.raw_user_meta_data->>'father_mobile', new.raw_user_meta_data->>'parentMobile'),
      COALESCE(new.raw_user_meta_data->>'parent_email', new.raw_user_meta_data->>'parentEmail'),
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