import supabaseAdmin from './supabase/supabaseAdmin.js';

async function testOrQuery() {
    try {
        const courseId = 97; // TEXT2 is under course 97
        console.log(`Running OR query for courseId = ${courseId}...`);
        
        const { data: keys, error } = await supabaseAdmin
            .from('enrollment_keys')
            .select(`
                *,
                course:courses(id, name, description)
            `)
            .or(`course_id.eq.${courseId},key_type.eq.global,course_id.is.null`);

        if (error) {
            console.error('❌ OR Query failed:', error.code, '-', error.message);
        } else {
            console.log(`✅ OR Query succeeded! Found ${keys.length} keys:`);
            keys.forEach(k => {
                console.log(`- ID: ${k.id}, Code: ${k.key_code}, Course ID: ${k.course_id}, Key Type: ${k.key_type}`);
            });
        }
    } catch (err) {
        console.error('Fatal query error:', err);
    }
}

testOrQuery();
