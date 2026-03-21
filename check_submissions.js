
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSubmissions() {
    const { data: courses } = await supabase.from('courses').select('id, name');
    console.log('Courses:', courses);

    const { data: submissions, error } = await supabase.from('test_submissions').select('*');
    if (error) {
        console.error(error);
    } else {
        console.log('Total submissions:', submissions.length);
        console.log('Submissions detail:', JSON.stringify(submissions.slice(0, 5), null, 2));

        const coursesWithSubmissions = [...new Set(submissions.map(s => s.course_id))];
        console.log('Course IDs with submissions:', coursesWithSubmissions);
    }
}

checkSubmissions();
