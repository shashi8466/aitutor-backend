
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkProgress() {
    const { data: progress, error } = await supabase.from('student_progress').select('*, profiles(name), courses(name)');
    if (error) {
        console.error(error);
    } else {
        console.log('Total progress rows:', progress.length);
        console.log('Progress detail:', JSON.stringify(progress, null, 2));
    }
}

checkProgress();
