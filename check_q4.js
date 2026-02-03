import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkQ4() {
    const { data } = await supabase.from('questions').select('topic, question').ilike('question', '%12p%').limit(1);
    if (data?.[0]) {
        console.log("Q4 Found:");
        console.log("TOPIC:", data[0].topic);
        console.log("TEXT: ", data[0].question.substring(0, 100));
    } else {
        console.log("Q4 Not Found");
    }
}
checkQ4();
