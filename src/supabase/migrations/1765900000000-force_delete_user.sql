/*
# FORCE DELETE USER
1. Purpose
   - Completely removes a specific user from the Authentication system (`auth.users`).
   - This fixes the "User already registered" error when the user is not visible in the profiles table.

2. INSTRUCTIONS
   - Copy the SQL command below.
   - Go to your Supabase Dashboard -> SQL Editor.
   - Paste and Run.
*/

-- Replace the email below with the one you want to delete
DELETE FROM auth.users WHERE email = 'shashikumaredula@gmail.com';

/* 
   Note: This will automatically delete the profile row as well 
   due to the "ON DELETE CASCADE" rule we set up earlier.
*/