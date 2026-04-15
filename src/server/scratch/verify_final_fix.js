import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function verify12() {
    const { data: course } = await supabase.from('courses').select('*').eq('id', 12).single();
    console.log('Course 12:', JSON.stringify(course, null, 2));
    
    // Check policies again
    const { data: policies } = await supabase.rpc('exec_sql', {
        sql_query: "SELECT * FROM pg_policies WHERE tablename = 'courses'"
    });
    console.log('Policies:', JSON.stringify(policies, null, 2));
}

verify12();
