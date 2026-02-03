
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function findSubmission() {
    console.log("🔍 Searching for submission from Jan 13...");

    const { data: submissions, error: subError } = await supabase
        .from('test_submissions')
        .select('*')
        .gte('created_at', '2026-01-13T00:00:00Z')
        .lte('created_at', '2026-01-14T00:00:00Z');

    if (subError) {
        console.error("❌ Error fetching submissions:", subError);
        return;
    }

    console.log(`📊 Found ${submissions?.length || 0} submissions on Jan 13.`);
    submissions.forEach(sub => {
        console.log(`📝 Submission ${sub.id}:`, {
            raw_score: sub.raw_score,
            scaled_score: sub.scaled_score,
            total_responses: sub.incorrect_questions?.length + sub.correct_questions?.length,
            incorrect: sub.incorrect_questions?.length,
            correct: sub.correct_questions?.length
        });
    });
}

findSubmission();
