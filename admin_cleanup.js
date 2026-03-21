
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is missing in .env');
    process.exit(1);
}

const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function finalAdminCleanup() {
    console.log('🚀 Starting ADMIN Database Cleanup for Mixed Topics...');

    // 1. Get all questions with potential mixed text
    const { data: questions, error: fetchError } = await adminSupabase
        .from('questions')
        .select('id, question, topic')
        .or('question.ilike.%and Purpose%,question.ilike.%Rhetorical Synthesis%');

    if (fetchError) {
        console.error('Fetch error:', fetchError);
        return;
    }

    console.log(`Found ${questions.length} candidates for fixing.`);

    for (const q of questions) {
        let newQuestion = q.question;
        let newTopic = q.topic || "";

        if (newQuestion.toLowerCase().includes('and purpose')) {
            newQuestion = newQuestion.replace(/and Purpose/gi, '').replace(/^\s*[,\s.:-]+\s*/, '').trim();
            newTopic = "Text Structure and Purpose";
        } else if (newQuestion.toLowerCase().includes('rhetorical synthesis')) {
            newQuestion = newQuestion.replace(/Rhetorical Synthesis/gi, '').replace(/^\s*[,\s.:-]+\s*/, '').trim();
            newTopic = "Rhetorical synthesis";
        }

        const { error: updateError } = await adminSupabase
            .from('questions')
            .update({ 
                question: newQuestion, 
                topic: newTopic 
            })
            .eq('id', q.id);

        if (updateError) {
            console.error(`Failed to update ID ${q.id}:`, updateError.message);
        } else {
            console.log(`✅ Fixed ID ${q.id}: "${newTopic}"`);
        }
    }

    // 2. Extra safety for ID 2229 if it wasn't caught
    const { data: q2229 } = await adminSupabase.from('questions').select('*').eq('id', 2229).single();
    if (q2229 && q2229.question.includes('and Purpose')) {
        const cleaned = q2229.question.replace('and Purpose', '').replace(/^\s*[,\s.:-]+\s*/, '').trim();
        await adminSupabase.from('questions').update({ question: cleaned, topic: "Text Structure and Purpose" }).eq('id', 2229);
        console.log('✅ Forced fix for ID 2229');
    }

    console.log('✨ Admin Cleanup Complete!');
}

finalAdminCleanup();
