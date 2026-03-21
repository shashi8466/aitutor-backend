import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function testQuery() {
    console.log("Checking profiles for linked_students column...");
    const { data, error } = await supabase.from('profiles').select('id, name, linked_students').limit(1);
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Success! Data:", data);
        if (data && data.length > 0) {
            console.log("Has linked_students property:", 'linked_students' in data[0]);
        }
    }
}
testQuery();
