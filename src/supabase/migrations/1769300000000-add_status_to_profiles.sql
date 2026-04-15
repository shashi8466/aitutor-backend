/*
# Add Status Column to Profiles Table

1. Changes
   - Add `status` column to `profiles` table
   - Default value: 'active'
   - Valid values: 'active', 'inactive'
   
2. Purpose
   - Allows admins to activate/deactivate user accounts
   - Required for AdminParentManagement toggle functionality
   
3. Migration
   - Adds column if it doesn't exist
   - Sets existing users to 'active' by default
*/

-- Add status column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN status text DEFAULT 'active';
    
    -- Set all existing users to active
    UPDATE profiles SET status = 'active' WHERE status IS NULL;
    
    RAISE NOTICE 'Added status column to profiles table';
  ELSE
    RAISE NOTICE 'Status column already exists in profiles table';
  END IF;
END $$;

-- Add check constraint to ensure valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_status_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_status_check 
    CHECK (status IN ('active', 'inactive'));
    
    RAISE NOTICE 'Added status check constraint';
  ELSE
    RAISE NOTICE 'Status check constraint already exists';
  END IF;
END $$;

-- Create index for faster status filtering
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- Update RLS policies to allow admins to update status
-- (Admin should be able to update ANY user's status)
DROP POLICY IF EXISTS "Admins can update any profile status" ON profiles;
CREATE POLICY "Admins can update any profile status" 
ON profiles FOR UPDATE TO authenticated 
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Ensure users can still update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
