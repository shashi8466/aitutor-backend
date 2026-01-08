/* 
# Create Site Settings Table
1. New Tables
   - `site_settings`
     - `id` (integer, primary key, constrained to 1 to ensure singleton)
     - `app_name` (text)
     - `logo_url` (text)
     - `updated_at` (timestamp)
2. Security
   - Enable RLS
   - Public Read Policy (Everyone sees the logo/name)
   - Admin Update Policy (Only admins change it)
3. Seed Data
   - Inserts default 'AI Tutor' configuration
*/

CREATE TABLE IF NOT EXISTS site_settings (
  id integer PRIMARY KEY DEFAULT 1,
  app_name text DEFAULT 'AI Tutor',
  logo_url text, -- If null, use default icon
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row_check CHECK (id = 1)
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone (including unauthenticated) to read settings
CREATE POLICY "Public read settings" ON site_settings FOR SELECT USING (true);

-- Allow admins to update settings
CREATE POLICY "Admins update settings" ON site_settings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Seed default data
INSERT INTO site_settings (id, app_name) VALUES (1, 'AI Tutor') ON CONFLICT (id) DO NOTHING;