import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
    console.log("Checking Course 19...");

    // Check uploads
    const { data: uploads } = await supabase.from('uploads').select('*').eq('course_id', 19);
    console.log(`Found ${uploads?.length || 0} uploads for course 19.`);
    if (uploads) {
        uploads.forEach(u => console.log(` - ID: ${u.id}, Level: ${u.level}, Status: ${u.status}, Category: ${u.category}`));
    }

    // Check questions
    const { data: questions } = await supabase.from('questions').select('id, course_id, level, upload_id').eq('course_id', 19);
    console.log(`Found ${questions?.length || 0} questions for course 19.`);
    if (questions && questions.length > 0) {
        const levels = [...new Set(questions.map(q => q.level))];
        console.log(`Levels found in questions: ${levels.join(', ')}`);

        const matchingMedium = questions.filter(q => (q.level || '').toLowerCase() === 'medium');
        console.log(`Matching 'medium': ${matchingMedium.length}`);
    } else {
        // Check if there are ANY questions
        const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true });
        console.log(`Total questions in database: ${count}`);
    }
}

inspect();
