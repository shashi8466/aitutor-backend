/* 
# Admin Profile Update Policy
1. Purpose:
   - Allow admin users to update user roles in the profiles table
   - This enables admin panel functionality to manage user roles
*/

-- Add policy to allow admin users to update profiles
CREATE POLICY "Admins can update any profile" 
ON profiles FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);