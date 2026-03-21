/**
 * Fix Tutor Assigned Courses
 * Updates tutor "Shashi Kumar Edula" to remove invalid course IDs (5, 6)
 * and add the actual existing course IDs (12, 13) along with existing valid ones (1, 4)
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function fixTutorCourses() {
    console.log('🔧 Fixing tutor assigned courses...\n');

    // 1. Get all valid course IDs
    const { data: courses, error: courseErr } = await supabase.from('courses').select('id, name');
    if (courseErr) {
        console.error('❌ Cannot fetch courses:', courseErr.message);
        return;
    }
    const validCourseIds = courses.map(c => c.id);
    console.log('✅ Valid course IDs:', validCourseIds);
    courses.forEach(c => console.log(`   - [${c.id}] ${c.name}`));

    // 2. Get all tutors
    const { data: tutors, error: tutorErr } = await supabase
        .from('profiles')
        .select('id, name, email, assigned_courses')
        .eq('role', 'tutor');

    if (tutorErr) {
        console.error('❌ Cannot fetch tutors:', tutorErr.message);
        return;
    }

    // 3. Fix each tutor
    for (const tutor of tutors) {
        const currentAssigned = (tutor.assigned_courses || []).map(Number);
        const invalidIds = currentAssigned.filter(id => !validCourseIds.includes(id));
        
        if (invalidIds.length > 0) {
            console.log(`\n⚠️ Tutor "${tutor.name}" (${tutor.email}) has invalid course IDs: ${JSON.stringify(invalidIds)}`);
            
            // Keep valid ones and add ALL valid courses
            const fixedAssigned = validCourseIds; // Assign all courses to the tutor
            
            console.log(`   Current: ${JSON.stringify(currentAssigned)}`);
            console.log(`   Fixed:   ${JSON.stringify(fixedAssigned)}`);

            const { error: updateErr } = await supabase
                .from('profiles')
                .update({ assigned_courses: fixedAssigned })
                .eq('id', tutor.id);

            if (updateErr) {
                console.error(`   ❌ Failed to update: ${updateErr.message}`);
            } else {
                console.log(`   ✅ Updated successfully!`);
            }
        } else {
            console.log(`\n✅ Tutor "${tutor.name}" has valid assigned courses: ${JSON.stringify(currentAssigned)}`);
        }
    }

    // 4. Verify
    console.log('\n--- Verification ---');
    const { data: updated } = await supabase
        .from('profiles')
        .select('name, assigned_courses')
        .eq('role', 'tutor');
    
    updated.forEach(t => {
        console.log(`  Tutor "${t.name}": assigned_courses = ${JSON.stringify(t.assigned_courses)}`);
    });

    console.log('\n✅ Fix complete!');
}

fixTutorCourses().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
