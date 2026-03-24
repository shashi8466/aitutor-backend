import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './src/server/utils/notificationService.js';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkAndSendToKumar() {
    console.log("Looking up all students with 'Kumar' in name...");
    const { data: students, error } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .ilike('name', '%Kumar%')
        .eq('role', 'student');
    
    if (error || !students?.length) {
        console.error("❌ Could not find any students named Kumar:", error);
        return;
    }

    const { data: allParents, error: parentError } = await supabase
        .from('profiles')
        .select('id, name, email, linked_students')
        .eq('role', 'parent');

    for (const student of students) {
        console.log(`\n--- Checking Student: ${student.name} (${student.email}) ---`);
        
        const parent = allParents?.find(p => {
            const linked = p.linked_students || [];
            return Array.isArray(linked) && linked.some(id => String(id).trim() === String(student.id).trim());
        });

        if (parent) {
            console.log(`✅ Found Parent! Name: ${parent.name}, Email: ${parent.email}`);
        } else {
            console.warn(`⚠️ No parent linked to this student was found in the DB.`);
        }
    }
}

checkAndSendToKumar();
