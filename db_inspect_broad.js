import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
    console.log("Inspecting Supabase...");

    const { data: courses } = await supabase.from('courses').select('id, name');
    console.log(`Courses: ${courses?.length || 0}`);
    if (courses) courses.forEach(c => console.log(` - ${c.id}: ${c.name}`));

    const { count: uCount } = await supabase.from('uploads').select('*', { count: 'exact', head: true });
    console.log(`Total Uploads: ${uCount}`);

    const { count: qCount } = await supabase.from('questions').select('*', { count: 'exact', head: true });
    console.log(`Total Questions: ${qCount}`);
}

inspect();
