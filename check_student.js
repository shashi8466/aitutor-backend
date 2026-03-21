import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function check() {
    const { data: submissions, error } = await supabase
        .from('test_submissions')
        .select('course_id, level, courses(id, name)')
        .limit(1);
    console.log("Error:", error);
    console.log("Submissions data:", submissions);
}
check().then(() => console.log('Done')).catch(console.error);
