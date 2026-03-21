
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data } = await supabase.from('test_submissions').select('user_id, test_date, raw_score').eq('course_id', 4).order('test_date', { ascending: false });
    console.log(data);
}
check();
