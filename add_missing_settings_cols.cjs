
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function fixInternalSettingsTable() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('🔧 Fixing internal_settings table schema...');
    
    const sql = `
    -- 1. Ensure columns exist
    DO $$ 
    BEGIN 
        -- email_config
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_settings' AND column_name = 'email_config') THEN 
            ALTER TABLE public.internal_settings ADD COLUMN email_config jsonb DEFAULT '{"enabled": false, "host": "", "port": "", "user": "", "pass": "", "from_email": ""}'::jsonb; 
        END IF;

        -- sms_config
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_settings' AND column_name = 'sms_config') THEN 
            ALTER TABLE public.internal_settings ADD COLUMN sms_config jsonb DEFAULT '{"enabled": false, "provider": "twilio", "account_sid": "", "auth_token": "", "from_number": ""}'::jsonb; 
        END IF;

        -- payment_config
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_settings' AND column_name = 'payment_config') THEN 
            ALTER TABLE public.internal_settings ADD COLUMN payment_config jsonb DEFAULT '{"enabled": false, "provider": "stripe", "public_key": "", "secret_key": ""}'::jsonb; 
        END IF;

        -- api_config (ensure it has correct default)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_settings' AND column_name = 'api_config') THEN 
            ALTER TABLE public.internal_settings ADD COLUMN api_config jsonb DEFAULT '{"openai_key": "", "gemini_key": "", "other_integrations": []}'::jsonb; 
        END IF;
    END $$;

    -- 2. Ensure initial row exists with id 1
    INSERT INTO public.internal_settings (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING;
    `;

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('❌ Error executing fix:', error.message);
    } else {
        console.log('✅ internal_settings fix applied successfully!');
    }
}

fixInternalSettingsTable().catch(console.error);
