const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function diagnostic() {
    console.log('--- DIAGNOSTIC START ---');

    // 1. Check Tutor
    const { data: tutor } = await supabase.from('profiles').select('*').eq('email', 'ssky57771@gmail.com').single();
    console.log('Tutor:', tutor ? { id: tutor.id, role: tutor.role, courses: tutor.assigned_courses } : 'MISSING');

    // 2. Check Courses
    const { data: courses } = await supabase.from('courses').select('id, name');
    console.log('Courses in DB:', courses);

    // 3. Check Enrollments
    const { data: enrollments } = await supabase.from('enrollments').select('id, user_id, course_id').limit(5);
    console.log('Enrollments sample:', enrollments);

    // 4. Check Grade Scales
    const { data: scales } = await supabase.from('grade_scales').select('*').limit(5);
    console.log('Grade Scales:', scales);

    // 5. Check Test Submissions
    const { data: subs } = await supabase.from('test_submissions').select('id, user_id, course_id, scaled_score, math_scaled_score, reading_scaled_score').limit(5);
    console.log('Submissions sample:', subs);

    console.log('--- DIAGNOSTIC END ---');
}

diagnostic();
