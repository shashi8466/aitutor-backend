import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function checkParents() {
    console.log("Checking parent profiles...");
    const { data, error } = await supabase.from('profiles').select('id, name, role, linked_students').eq('role', 'parent');
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Parents found:", data);
    }
}
checkParents();
