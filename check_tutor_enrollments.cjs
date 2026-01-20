const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkTutor() {
    const email = 'ssky57771@gmail.com';
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('email', email).single();
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    console.log('Tutor Profile:', JSON.stringify(profile, null, 2));

    const { data: courses } = await supabase.from('courses').select('id, name');
    console.log('All Courses:', courses);

    const { data: enr } = await supabase.from('enrollments').select('*, user:profiles(name, email)').in('course_id', profile.assigned_courses || []);
    console.log('Enrollments for Tutor Courses:', enr.length);
    if (enr.length > 0) {
        console.log('Sample Enrollment:', JSON.stringify(enr[0], null, 2));
    }
}

checkTutor();
