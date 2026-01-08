/* 
# Advanced Settings Migration
1. New Tables
   - `internal_settings` (Singleton table for sensitive configs)
2. Columns
   - `id` (integer, primary key, constrained to 1)
   - `payment_config` (jsonb)
   - `email_config` (jsonb)
   - `sms_config` (jsonb)
   - `api_config` (jsonb)
   - `updated_at` (timestamp)
3. Security
   - Enable RLS
   - Private Policy (Only admins can SELECT/UPDATE)
*/

CREATE TABLE IF NOT EXISTS internal_settings (
  id integer PRIMARY KEY DEFAULT 1,
  payment_config jsonb DEFAULT '{"enabled": false, "provider": "stripe", "public_key": "", "secret_key": ""}'::jsonb,
  email_config jsonb DEFAULT '{"enabled": false, "host": "", "port": "", "user": "", "pass": "", "from_email": ""}'::jsonb,
  sms_config jsonb DEFAULT '{"enabled": false, "provider": "twilio", "account_sid": "", "auth_token": "", "from_number": ""}'::jsonb,
  api_config jsonb DEFAULT '{"openai_key": "", "gemini_key": "", "other_integrations": []}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT singleton_check CHECK (id = 1)
);

ALTER TABLE internal_settings ENABLE ROW LEVEL SECURITY;

-- Admins only policy
CREATE POLICY "Admins only internal_settings" 
ON internal_settings 
FOR ALL 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Seed initial data
INSERT INTO internal_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
