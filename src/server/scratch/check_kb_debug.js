
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkUploads() {
    const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching uploads:', error);
        return;
    }

    console.log('Recent Uploads:');
    data.forEach(u => {
        console.log(`ID: ${u.id}, Name: ${u.file_name}, Status: ${u.status}, Qs: ${u.questions_count}, Category: ${u.category}`);
    });

    if (data.length > 0) {
        const uploadId = data[0].id;
        console.log(`\nChecking questions for Upload ID ${uploadId}...`);
        const { data: qs, error: qError } = await supabase
            .from('questions')
            .select('id, question')
            .eq('upload_id', uploadId);
        
        if (qError) console.error('Error fetching questions:', qError);
        else console.log(`Found ${qs.length} questions.`);
    }
}

checkUploads();
