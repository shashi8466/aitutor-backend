import supabaseAdmin from './supabase/supabaseAdmin.js';

async function inspectKeys() {
    try {
        console.log('Fetching all enrollment keys from Supabase...');
        const { data: keys, error } = await supabaseAdmin
            .from('enrollment_keys')
            .select('*');
            
        if (error) {
            console.error('Error fetching keys:', error);
            return;
        }
        
        console.log(`Successfully found ${keys.length} keys:`);
        keys.forEach(k => {
            console.log(`- ID: ${k.id}, Code: ${k.key_code}, Course ID: ${k.course_id}, Key Type: ${k.key_type}, Auto-enroll: ${k.auto_enroll_new_courses}, Active: ${k.is_active}`);
        });
    } catch (err) {
        console.error('Fatal inspection error:', err);
    }
}

inspectKeys();
