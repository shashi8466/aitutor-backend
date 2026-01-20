const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error('CRITICAL: Service role key missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
    // tutor kumar's CORRECT ID
    const userId = '1535a7f6-94a7-4fdd-9558-516f48154819';

    console.log('Testing get_tutor_courses RPC...');
    const { data: courses, error: cError } = await supabase.rpc('get_tutor_courses', { requested_user_id: userId });
    if (cError) {
        console.error('get_tutor_courses Error:', cError.message);
    } else {
        console.log('get_tutor_courses Success:', courses.length, 'courses found');
    }

    console.log('\nTesting get_tutor_students RPC...');
    const { data: students, error: sError } = await supabase.rpc('get_tutor_students', {
        requested_user_id: userId,
        course_filter: null
    });
    if (sError) {
        console.error('get_tutor_students Error:', sError.message);
    } else {
        console.log('get_tutor_students Success:', students.length, 'students found');
    }
}

testRpc();
