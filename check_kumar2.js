
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data } = await supabase.from('test_submissions').select('raw_score, raw_score_percentage, scaled_score').eq('user_id', '1535a7f6-94a7-4fdd-9558-516f48154819').eq('course_id', 4).order('test_date', { ascending: false });
    console.log(data);
}
check();
