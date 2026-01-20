const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkSubmissions() {
    const courseId = 1; // SAT MATH
    const { data: subs, error } = await supabase.from('test_submissions').select('*').eq('course_id', courseId);
    console.log(`Submissions for course ${courseId}:`, subs.length);
    if (subs.length > 0) {
        console.log('Sample submission:', subs[0]);
    }

    // Check all submissions
    const { data: all } = await supabase.from('test_submissions').select('*');
    console.log('Total submissions in DB:', all.length);
}

checkSubmissions();
