import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function inspectLatestQuestions() {
    console.log('🔍 Inspecting latest 5 questions in database...\n');

    const { data: questions, error } = await supabase
        .from('questions')
        .select('id, question, topic, options, type, created_at')
        .order('id', { ascending: false })
        .limit(5);

    if (error) {
        console.error('❌ Error fetching questions:', error);
        return;
    }

    questions.forEach(q => {
        console.log(`🆔 Question ID: ${q.id}`);
        console.log(`Created: ${new Date(q.created_at).toLocaleString()}`);
        console.log(`🏷️  Topic: "${q.topic}"`);
        console.log(`💡 Type: ${q.type}`);
        console.log(`❓ Question: "${q.question.substring(0, 150)}..."`);
        console.log(`📋 Options: ${JSON.stringify(q.options)}`);
        console.log('-'.repeat(50));
    });
}

inspectLatestQuestions();

