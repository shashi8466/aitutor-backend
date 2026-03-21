
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const adminSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
    const { data: q } = await adminSupabase.from('questions').select('*').eq('id', 2229).single();
    if (q) {
        console.log('ID 2229:');
        console.log('Topic:', q.topic);
        console.log('Question:', q.question);
    } else {
        console.log('ID 2229 not found');
    }
}
verify();
