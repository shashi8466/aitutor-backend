import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function findBadQuestion() {
    // Search for the specific text from screenshot Q12
    const { data, error } = await supabase
        .from('questions')
        .select('*')
        .ilike('question', '%Ratios rates proportional%');

    console.log('Found:', data?.length);
    if (data?.length > 0) {
        console.log('DATA:', data[0]);
    } else {
        console.log('Could not find question matching "Ratios rates proportional"');
        // Search for Q14
        const { data: d2 } = await supabase.from('questions').select('*').ilike('question', '%Two-variable data%');
        console.log('Found Q14?', d2?.length);
        if (d2?.length > 0) console.log('DATA Q14:', d2[0]);
    }
}
findBadQuestion();
