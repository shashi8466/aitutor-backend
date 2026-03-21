
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkUploads() {
    const { data, error } = await supabase.from('uploads').select('course_id');
    if (error) {
        console.error(error);
    } else {
        const ids = [...new Set(data.map(u => u.course_id))];
        console.log('Course IDs in uploads:', ids);
    }
}

checkUploads();
