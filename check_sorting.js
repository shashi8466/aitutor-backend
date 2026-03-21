
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSorting() {
    const { data: submissions } = await supabase.from('test_submissions')
        .select('user_id, raw_score_percentage, scaled_score, test_date')
        .eq('course_id', 4)
        .order('test_date', { ascending: false });
    console.log(submissions);
}

checkSorting();
