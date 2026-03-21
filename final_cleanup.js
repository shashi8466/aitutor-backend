
import supabase from './src/supabase/supabase.js';

async function finalCleanup() {
    console.log('Final Cleanup Starting...');

    // 1. Get all questions with "and Purpose"
    const { data: q1, error: e1 } = await supabase
        .from('questions')
        .select('id, question, topic')
        .ilike('question', '%and Purpose%');

    if (e1) console.error(e1);
    else {
        for (const q of q1) {
            if (q.question.includes('and Purpose')) {
                const newQuestion = q.question.replace('and Purpose', '').replace(/^\s*[,\s.:-]+\s*/, '').trim();
                const newTopic = "Text Structure and Purpose";
                await supabase.from('questions').update({ question: newQuestion, topic: newTopic }).eq('id', q.id);
                console.log(`Fixed ID ${q.id} (Text Structure and Purpose)`);
            }
        }
    }

    // 2. Get all questions with "Rhetorical Synthesis"
    const { data: q2, error: e2 } = await supabase
        .from('questions')
        .select('id, question, topic')
        .ilike('question', '%Rhetorical Synthesis%');

    if (e2) console.error(e2);
    else {
        for (const q of q2) {
            if (q.question.toLowerCase().includes('rhetorical synthesis')) {
                const newQuestion = q.question.replace(/Rhetorical Synthesis/i, '').replace(/^\s*[,\s.:-]+\s*/, '').trim();
                const newTopic = "Rhetorical synthesis";
                await supabase.from('questions').update({ question: newQuestion, topic: newTopic }).eq('id', q.id);
                console.log(`Fixed ID ${q.id} (Rhetorical synthesis)`);
            }
        }
    }

    console.log('Cleanup Done.');
}

finalCleanup();
