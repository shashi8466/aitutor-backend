import supabase from './src/supabase/supabaseAdmin.js';
import dotenv from 'dotenv';
dotenv.config();

const userId = 'f8d8a938-ddac-45d2-81c5-92f4eeb672f4'; // Shashi's ID

async function testDashboard() {
    console.log(`Testing dashboard for user: ${userId}`);

    try {
        console.log('1. Fetching profile...');
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        console.log('   Profile assigned_courses:', profile.assigned_courses);

        let rawAssigned = profile?.assigned_courses || [];
        if (typeof rawAssigned === 'string') {
            try { rawAssigned = JSON.parse(rawAssigned); } catch (e) { rawAssigned = []; }
        }
        const assignedCourses = Array.isArray(rawAssigned) ? rawAssigned.map(Number).filter(id => !isNaN(id)) : [];
        console.log('   Normalized assigned courses:', assignedCourses);

        if (assignedCourses.length > 0) {
            console.log('2. Fetching enrollment counts...');
            const { count } = await supabase.from('enrollments').select('*', { count: 'exact', head: true }).in('course_id', assignedCourses);
            console.log('   Total enrollments:', count);

            console.log('3. Fetching unique students...');
            const { data: enrollmentData } = await supabase.from('enrollments').select('user_id').in('course_id', assignedCourses);
            console.log('   Unique students check (raw count):', enrollmentData?.length);

            console.log('4. Fetching courses...');
            const { data: courses } = await supabase.from('courses').select('id, name, description, tutor_type, created_at').in('id', assignedCourses);
            console.log('   Courses found:', courses?.length);

            console.log('5. Fetching recent activity...');
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const { data: recentSubmissions, error: submissionsError } = await supabase
                .from('test_submissions')
                .select('*, user:profiles!user_id(name, email)')
                .in('course_id', assignedCourses)
                .gte('created_at', sevenDaysAgo.toISOString())
                .order('created_at', { ascending: false })
                .limit(10);

            if (submissionsError) {
                console.error('   Submissions error:', submissionsError);
            } else {
                console.log('   Recent submissions found:', recentSubmissions?.length);
            }
        }

        console.log('DONE');
    } catch (e) {
        console.error('CRASH:', e);
    }
}

testDashboard();
