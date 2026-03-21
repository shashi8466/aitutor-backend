import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkParent() {
    const { data: parents } = await supabase.from('profiles').select('*').eq('role', 'parent').limit(5);
    console.log("Sample Parent record:", JSON.stringify(parents?.[0] || {}, null, 2));

    if (parents?.[0]) {
        console.log("Keys in profile object:", Object.keys(parents[0]));
        console.log("linked_students value:", parents[0].linked_students);
        console.log("linked_students type:", typeof parents[0].linked_students);
        console.log("is array:", Array.isArray(parents[0].linked_students));
    }
}
checkParent().then(() => console.log('Done'));
