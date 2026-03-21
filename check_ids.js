
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkIds() {
    const { data } = await supabase.from('test_submissions').select('id, user_id, course_id, test_date').eq('id', 'a8abf66c-18a0-4318-aff4-2f08dc05ff45');
    console.log(data);
}
checkIds();
