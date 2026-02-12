import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkConfig() {
    const { data, error } = await supabase
        .from('internal_settings')
        .select('*')
        .eq('id', 1)
        .single();

    if (error) {
        console.error('Error fetching settings:', error);
        return;
    }

    console.log('Current Internal Settings:');
    console.log('OpenAI Key in DB:', data.api_config?.openai_key ? 'Present' : 'Missing');
    console.log('Gemini Key in DB:', data.api_config?.gemini_key ? 'Present' : 'Missing');

    if (data.api_config?.gemini_key) {
        console.log('Gemini Key prefix:', data.api_config.gemini_key.substring(0, 10));
    }
}

checkConfig();
