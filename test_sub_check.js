import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSubmissions() {
    console.log('--- Checking Test Submissions ---');
    const { data, error } = await supabase
        .from('test_submissions')
        .select('id, user_id, course_id, test_date, raw_score_percentage')
        .order('test_date', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(`Found ${data.length} submissions.`);
        console.table(data);
    }
}

checkSubmissions();
