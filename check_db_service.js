
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkSubmissions() {
    const { data: submissions, error } = await supabase.from('test_submissions').select('*');
    if (error) {
        console.error(error);
    } else {
        console.log('Total submissions:', submissions.length);
        if (submissions.length > 0) {
            console.log('Submissions user_ids:', [...new Set(submissions.map(s => s.user_id))]);
            console.log('Submissions course_ids:', [...new Set(submissions.map(s => s.course_id))]);
            console.log(submissions.slice(0, 3));
        }
    }

    const { data: progress } = await supabase.from('student_progress').select('*');
    if (progress) {
        console.log('Total progress:', progress.length);
        if (progress.length > 0) {
            console.log('Progress user_ids:', [...new Set(progress.map(s => s.user_id))]);
            console.log('Progress course_ids:', [...new Set(progress.map(s => s.course_id))]);
        }
    }
}

checkSubmissions();
