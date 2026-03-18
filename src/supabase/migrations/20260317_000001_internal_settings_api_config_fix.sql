-- Ensure `internal_settings.api_config` exists (fixes Supabase schema cache errors)
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'internal_settings'
  ) THEN
    CREATE TABLE public.internal_settings (
      id integer PRIMARY KEY DEFAULT 1,
      payment_config jsonb DEFAULT '{"enabled": false, "provider": "stripe", "public_key": "", "secret_key": ""}'::jsonb,
      email_config jsonb DEFAULT '{"enabled": false, "host": "", "port": "", "user": "", "pass": "", "from_email": ""}'::jsonb,
      sms_config jsonb DEFAULT '{"enabled": false, "provider": "twilio", "account_sid": "", "auth_token": "", "from_number": ""}'::jsonb,
      api_config jsonb DEFAULT '{"openai_key": "", "gemini_key": "", "other_integrations": []}'::jsonb,
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT singleton_check CHECK (id = 1)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'internal_settings'
      AND column_name = 'api_config'
  ) THEN
    ALTER TABLE public.internal_settings
      ADD COLUMN api_config jsonb DEFAULT '{"openai_key": "", "gemini_key": "", "other_integrations": []}'::jsonb;
  END IF;

  -- Ensure singleton row exists
  INSERT INTO public.internal_settings (id)
  VALUES (1)
  ON CONFLICT (id) DO NOTHING;
END $$;

