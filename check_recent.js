
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const adminSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRecent() {
    console.log('Checking recently added questions...');
    const { data, error } = await adminSupabase
        .from('questions')
        .select('id, question, topic, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
        
    if (error) {
        console.error(error);
        return;
    }
    
    data.forEach(q => {
        console.log(`[ID ${q.id}] [Topic: ${q.topic}]`);
        console.log(`Text: ${q.question.substring(0, 100).replace(/\n/g, '\\n')}`);
        console.log('---');
    });
}

checkRecent();
