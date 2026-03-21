
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkScores() {
    const { data } = await supabase.from('test_submissions').select('*').eq('course_id', 4).order('test_date', { ascending: false }).limit(2);
    console.log(JSON.stringify(data, null, 2));
}

checkScores();
