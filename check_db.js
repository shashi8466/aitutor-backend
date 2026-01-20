
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkSync() {
    console.log('--- DB SYNC CHECK ---');

    const { count: profileCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    console.log('Profiles:', profileCount);

    const { count: enrollmentCount } = await supabase.from('enrollments').select('*', { count: 'exact', head: true });
    console.log('Enrollments:', enrollmentCount);

    const { count: submissionCount } = await supabase.from('test_submissions').select('*', { count: 'exact', head: true });
    console.log('Submissions:', submissionCount);

    const { data: adminProfiles } = await supabase.from('profiles').select('*').eq('role', 'admin');
    console.log('Admins Found:', adminProfiles?.length || 0);
    if (adminProfiles?.length > 0) {
        console.log('Admin Emails:', adminProfiles.map(p => p.email).join(', '));
    }

    const { data: courses } = await supabase.from('courses').select('id, name');
    console.log('Courses:', courses?.length || 0);
    if (courses) {
        for (const c of courses) {
            const { count: eCount } = await supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('course_id', c.id);
            const { count: sCount } = await supabase.from('test_submissions').select('*', { count: 'exact', head: true }).eq('course_id', c.id);
            console.log(`Course [${c.id}] ${c.name}: Enrollments=${eCount}, Submissions=${sCount}`);
        }
    }
}

checkSync();
