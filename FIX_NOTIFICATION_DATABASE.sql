-- ============================================
-- NOTIFICATION SYSTEM DATABASE SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add notification_preferences column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'notification_preferences'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN notification_preferences JSONB DEFAULT '{
      "email": true,
      "sms": true,
      "whatsapp": false,
      "testCompletion": true,
      "weeklyProgress": true,
      "testDueDate": true
    }';
    RAISE NOTICE 'Added notification_preferences column to profiles table';
  ELSE
    RAISE NOTICE 'notification_preferences column already exists';
  END IF;
END $$;

-- 2. Add last_active_at column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'last_active_at'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    RAISE NOTICE 'Added last_active_at column to profiles table';
  ELSE
    RAISE NOTICE 'last_active_at column already exists';
  END IF;
END $$;

-- 3. Update RLS policies to allow admins to update notification preferences
DROP POLICY IF EXISTS admin_update_notifications ON profiles;
CREATE POLICY admin_update_notifications ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to SELECT all profiles for management
DROP POLICY IF EXISTS admin_select_all_profiles ON profiles;
CREATE POLICY admin_select_all_profiles ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. Ensure phone_number and whatsapp_number columns exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN phone_number TEXT;
    RAISE NOTICE 'Added phone_number column to profiles table';
  ELSE
    RAISE NOTICE 'phone_number column already exists';
  END IF;
END $$;

DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'whatsapp_number'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN whatsapp_number TEXT;
    RAISE NOTICE 'Added whatsapp_number column to profiles table';
  ELSE
    RAISE NOTICE 'whatsapp_number column already exists';
  END IF;
END $$;

-- 5. Create index for faster role-based queries
DROP INDEX IF EXISTS idx_profiles_role;
CREATE INDEX idx_profiles_role ON profiles(role);

-- Create index for notification preferences
DROP INDEX IF EXISTS idx_profiles_notification_preferences;
CREATE INDEX idx_profiles_notification_preferences ON profiles USING GIN (notification_preferences);

-- 6. Verify the setup
SELECT 
  COUNT(*) FILTER (WHERE role = 'student') as total_students,
  COUNT(*) FILTER (WHERE role = 'parent') as total_parents,
  COUNT(*) FILTER (WHERE role = 'admin') as total_admins,
  COUNT(*) FILTER (WHERE role = 'student' AND notification_preferences IS NOT NULL) as students_with_prefs
FROM profiles;

-- 7. Show sample data
SELECT 
  id,
  name,
  email,
  role,
  last_active_at,
  phone_number,
  whatsapp_number,
  notification_preferences
FROM profiles
WHERE role IN ('student', 'parent')
ORDER BY role, name
LIMIT 10;
