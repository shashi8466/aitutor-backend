import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function checkSubmissions() {
    const studentId = '1535a7f6-94a7-4fdd-9558-516f48154819';
    console.log(`Checking submissions for student: ${studentId}...`);
    const { data, error } = await supabase.from('test_submissions').select('*').eq('user_id', studentId);
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log(`Found ${data?.length || 0} submissions.`);
        if (data && data.length > 0) {
            console.log("First submission sample:", data[0]);
        }
    }
}
checkSubmissions();
