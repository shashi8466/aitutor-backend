const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    console.log('--- DATABASE INSPECTION ---');

    try {
        const { data: profiles, error: pError } = await supabase.from('profiles').select('id, email, name, role, assigned_courses');
        if (pError) throw pError;
        console.log('Profiles Count:', profiles ? profiles.length : 0);
        const tutor = profiles.find(p => p.email === 'shashikumaredula@gmail.com');
        if (tutor) console.log('Tutor assigned_courses:', tutor.assigned_courses);
        console.log('Profiles Sample:', profiles.slice(0, 5));
    } catch (e) { console.error('Error fetching profiles:', e.message); }

    try {
        const { data: courses, error: cError } = await supabase.from('courses').select('id, name, created_at');
        if (cError) throw cError;
        console.log('Courses:', courses);
    } catch (e) { console.error('Error fetching courses:', e.message); }

    try {
        const { data: enrollments, error: eError } = await supabase.from('enrollments').select('id, user_id, course_id');
        if (eError) throw eError;
        console.log('Enrollments Count:', enrollments ? enrollments.length : 0);
    } catch (e) { console.error('Error fetching enrollments:', e.message); }

    try {
        const { data: subs, error: sError } = await supabase.from('test_submissions').select('*').order('created_at', { ascending: false }).limit(1);
        if (sError) throw sError;
        console.log('Latest Submission Details:', subs[0]);
    } catch (e) { console.error('Error fetching test_submissions:', e.message); }

    console.log('--- END ---');
}

inspect();
