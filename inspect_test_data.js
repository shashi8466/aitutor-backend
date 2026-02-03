
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function inspectSubmissions() {
    console.log("🔍 Inspecting test submissions and responses...");

    // 1. Get newest submission
    const { data: submissions, error: subError } = await supabase
        .from('test_submissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (subError) {
        console.error("❌ Error fetching submissions:", subError);
        return;
    }

    if (!submissions || submissions.length === 0) {
        console.log("ℹ️ No submissions found.");
        return;
    }

    const sub = submissions[0];
    console.log("📝 Latest Submission:", {
        id: sub.id,
        user_id: sub.user_id,
        course_id: sub.course_id,
        raw_score: sub.raw_score,
        scaled_score: sub.scaled_score,
        created_at: sub.created_at,
        incorrect_questions: sub.incorrect_questions,
        correct_questions: sub.correct_questions
    });

    // 2. Get responses for this submission
    const { data: responses, error: respError } = await supabase
        .from('test_responses')
        .select('*')
        .eq('submission_id', sub.id);

    if (respError) {
        console.error("❌ Error fetching responses:", respError);
    } else {
        console.log(`📊 Found ${responses?.length || 0} responses for submission ${sub.id}`);
        if (responses && responses.length > 0) {
            console.log("📝 Sample Response:", responses[0]);
        }
    }

    // 3. Inspect table structure
    const { data: columns } = await supabase.from('information_schema.columns').select('column_name, data_type').eq('table_name', 'test_submissions');
    console.log("📋 test_submissions columns:", columns?.map(c => c.column_name));
}

inspectSubmissions();
