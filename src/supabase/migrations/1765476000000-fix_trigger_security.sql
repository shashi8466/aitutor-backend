/* 
# Fix Trigger Security & Robustness
1. Updates `handle_new_user` function:
   - Sets `search_path = public` to prevent search_path hijacking vulnerabilities.
   - Adds `ON CONFLICT DO NOTHING` to prevent duplicate key errors from blocking signup.
   - Handles potentially missing metadata gracefully.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    -- Default to empty string if name is missing
    COALESCE(new.raw_user_meta_data->>'name', ''),
    -- Default to 'student' if role is missing
    COALESCE(new.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;