import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const sql = fs.readFileSync('FIX_ALL_TABLES_RLS.sql', 'utf8');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
        console.error('Error executing SQL via RPC:', error);
        
        console.log('Trying via fallback API/postREST functionality if any...');
    } else {
        console.log('SQL Executed successfully via RPC:', data);
    }
}

run();
