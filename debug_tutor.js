const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTutors() {
    console.log('Checking Tutors and Assignments...');

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'tutor');

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    console.log(`Found ${profiles.length} tutors:`);
    profiles.forEach(p => {
        console.log(`- ${p.email} (${p.id})`);
        console.log(`  Role: ${p.role}`);
        console.log(`  Approved: ${p.tutor_approved}`);
        console.log(`  Assigned Courses: ${JSON.stringify(p.assigned_courses)}`);
    });

    const { data: courses, error: courseError } = await supabase.from('courses').select('id, name');
    console.log('\nAvailable Courses:');
    courses.forEach(c => console.log(`- ${c.id}: ${c.name}`));
}

checkTutors();
