
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkColumns() {
    // We can't easily list columns via JS client without RPC, 
    // but we can try small inserts to see which fail.
    // Or we can query a single row and see keys.
    const { data, error } = await supabase.from('questions').select('*').limit(1);
    
    if (error) {
        console.error('Error fetching question row:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns in questions table:', Object.keys(data[0]).join(', '));
    } else {
        console.log('Questions table is empty. Trying to insert a dummy row to test columns...');
        const { error: insertError } = await supabase.from('questions').insert([{
            course_id: 1,
            question: 'test',
            type: 'short_answer',
            level: 'Easy'
        }]);
        if (insertError) console.error('Insert failed:', insertError);
        else console.log('Minimal insert succeeded.');
    }
}

checkColumns();
