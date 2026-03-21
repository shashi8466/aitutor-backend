
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const adminSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectQuestions() {
    console.log('Inspecting first words of all questions...');
    const { data: questions, error } = await adminSupabase
        .from('questions')
        .select('id, question, topic')
        .limit(3000);

    if (error) {
        console.error(error);
        return;
    }

    const startingWords = new Map();
    const problematic = [];

    questions.forEach(q => {
        const firstWords = q.question.trim().split(/\s+/).slice(0, 3).join(' ');
        startingWords.set(firstWords, (startingWords.get(firstWords) || 0) + 1);

        // Simple heuristics for problematic starts
        if (firstWords.match(/^[A-Z][a-z]+ [A-Z][a-z]+/)) {
           // Might be a topic name like "Words in"
           if (["Words in", "Text Structure", "Standard English", "Craft and", "Information and", "Expression of", "Rhetorical"].some(t => firstWords.startsWith(t))) {
               problematic.push(q);
           }
        }
        if (firstWords.match(/^[,\s.:-]+/)) {
            problematic.push(q);
        }
        if (firstWords.startsWith('and Purpose')) {
            problematic.push(q);
        }
    });

    console.log(`Found ${problematic.length} potentially problematic questions.`);
    problematic.slice(0, 50).forEach(q => {
        console.log(`[ID ${q.id}] [Topic: ${q.topic}] TEXT: "${q.question.substring(0, 50)}..."`);
    });
}

inspectQuestions();
