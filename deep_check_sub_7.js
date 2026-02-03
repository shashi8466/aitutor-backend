
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkSub7Details() {
    console.log("🔍 Deep Inspecting Responses for Submission 7...");

    const { data: responses, error } = await supabase
        .from('test_responses')
        .select('*, question:questions(id, question)')
        .eq('submission_id', 7);

    if (error) {
        console.error("❌ Error:", error);
        return;
    }

    console.log(`📊 Total Responses: ${responses?.length}`);
    if (responses && responses.length > 0) {
        responses.forEach((r, i) => {
            if (i < 3) {
                console.log(`📝 Resp ${i}:`, {
                    id: r.id,
                    is_correct: r.is_correct,
                    is_correct_type: typeof r.is_correct,
                    has_question: !!r.question,
                    question_id: r.question_id
                });
            }
        });
    }
}

checkSub7Details();
