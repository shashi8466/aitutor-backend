import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkKumar() {
    console.log("Checking DB for user 'Kumar'...");
    const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .ilike('name', '%Kumar%');
    
    if (error) {
        console.error("Error fetching:", error);
        return;
    }
    
    console.log("Matched Profiles:", data);
}

checkKumar();
