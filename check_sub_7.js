
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkSub7() {
    console.log("🔍 Inspecting Submission 7...");

    const { data: sub, error } = await supabase
        .from('test_submissions')
        .select('*')
        .eq('id', 7)
        .single();

    if (error) {
        console.error("❌ Error:", error);
        return;
    }

    console.log("📝 Submission 7 fields:", {
        id: sub.id,
        incorrect_questions: sub.incorrect_questions,
        incorrect_type: typeof sub.incorrect_questions,
        correct_questions: sub.correct_questions,
        correct_type: typeof sub.correct_questions
    });

    const { data: responses } = await supabase
        .from('test_responses')
        .select('*')
        .eq('submission_id', 7);

    console.log(`📊 Found ${responses?.length || 0} responses for sub 7`);
}

checkSub7();
