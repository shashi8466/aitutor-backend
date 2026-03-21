import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function checkSchema() {
    console.log("Checking test_submissions schema...");
    const { data: columns, error } = await supabase.from('information_schema.columns').select('column_name, data_type').eq('table_name', 'test_submissions');
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Columns:", columns);
    }
}
checkSchema();
