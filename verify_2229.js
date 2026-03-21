
import supabase from './src/supabase/supabase.js';

async function verifyFix() {
    const { data, error } = await supabase
        .from('questions')
        .select('id, question, topic')
        .eq('id', 2229)
        .single();

    if (error) console.error(error);
    else {
        console.log('Verification for ID 2229:');
        console.log('Topic:', data.topic);
        console.log('Question:', data.question.substring(0, 50));
    }
}

verifyFix();
