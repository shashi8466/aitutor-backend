
import supabase from './src/supabase/supabase.js';

async function forceUpdate() {
    console.log('Forcing update for ID 2229...');
    
    // 1. Fetch current
    const { data: q } = await supabase.from('questions').select('*').eq('id', 2229).single();
    if (!q) {
        console.log('Question 2229 not found!');
        return;
    }

    console.log('Current Type of topic:', typeof q.topic);
    console.log('Current Topic:', q.topic);

    const newQuestion = q.question.replace('and Purpose', '').replace(/^\s*[,\s.:-]+\s*/, '').trim();
    const newTopic = "Text Structure and Purpose";

    // 2. Update
    const { data, error, status } = await supabase
        .from('questions')
        .update({ 
            question: newQuestion, 
            topic: newTopic 
        })
        .eq('id', 2229)
        .select();

    if (error) {
        console.error('Update ERROR:', error);
    } else {
        console.log('Update STATUS:', status);
        console.log('Updated Data:', data);
    }
}

forceUpdate();
