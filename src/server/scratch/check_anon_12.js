import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkPublicAccess() {
    console.log('Checking Public Access to Course 12...');
    const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', 12)
        .maybeSingle();

    if (error) {
        console.error('❌ Error:', error.message);
        console.error('Code:', error.code);
    } else if (data) {
        console.log('✅ Success! Course 12 is public:', data.name);
    } else {
        console.log('❌ Course 12 not found or not public.');
    }
}

checkPublicAccess();
