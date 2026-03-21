import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    console.log('--- Checking Profiles & Test Submissions Schema ---');
    const { data: cols, error } = await supabase.rpc('get_table_schema', { tname: 'profiles' });
    
    // Fallback if RPC doesn't exist: use a sample row
    if (error) {
        console.log('RPC get_table_schema failed. Fetching sample row instead...');
        const { data: profile } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
        console.log('Columns in profiles:', Object.keys(profile || {}));
        
        const { data: sub } = await supabase.from('test_submissions').select('*').limit(1).maybeSingle();
        console.log('Columns in test_submissions:', Object.keys(sub || {}));
    } else {
        console.log('Table Schema:', cols);
    }
}

checkSchema();
