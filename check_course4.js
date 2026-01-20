
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkCourse4() {
    console.log('--- COURSE 4 (sat) CHECK ---');

    const { data: enrollments } = await supabase
        .from('enrollments')
        .select('*, profiles:user_id(*)')
        .eq('course_id', 4);

    console.log('Enrollments for Course 4:', enrollments?.length || 0);
    if (enrollments) {
        enrollments.forEach(e => {
            console.log(`Student: ${e.profiles?.name} (${e.profiles?.email}), Enrolled at: ${e.enrolled_at}`);
        });
    }
}

checkCourse4();
