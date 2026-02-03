
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function inspectTable() {
    console.log("🔍 Inspecting questions table...");
    const { data: columns, error } = await supabase.rpc('get_table_columns', { table_name: 'questions' });

    if (error) {
        // Fallback: try to select one row
        const { data: rows } = await supabase.from('questions').select('*').limit(1);
        if (rows && rows.length > 0) {
            console.log("📋 Columns found:", Object.keys(rows[0]));
        } else {
            console.log("❌ No rows to inspect columns.");
        }
    } else {
        console.log("📋 Columns:", columns);
    }
}

inspectTable();
