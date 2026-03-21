
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function addStatusColumn() {
    console.log('Adding status column...');
    // We can use a trick: If we can't run raw SQL, we can't add a column via supabase-js.
    // BUT, I can check if it's really missing by trying to insert a row with it.

    const { error } = await supabase.from('courses').update({ status: 'active' }).eq('id', 1);
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Success! Column exists.');
    }
}

addStatusColumn();
