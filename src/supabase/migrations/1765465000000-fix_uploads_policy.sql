/* 
# Fix Uploads Permissions
1. Security
   - Add missing UPDATE policy for `uploads` table.
   - Without this, the system cannot update the status from 'processing' to 'completed'.
*/

CREATE POLICY "Uploads are updatable by admins" 
ON uploads 
FOR UPDATE 
TO authenticated 
USING ( 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') 
);