
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function testEndpoint() {
    console.log("🧪 Testing detailed submission endpoint for ID 7...");

    // We'll simulate what the backend does
    const sid = 7;

    const { data: submission, error } = await supabase
        .from('test_submissions')
        .select(`
            *,
            course:courses(id, name, description),
            user:profiles!user_id(id, name, email)
        `)
        .eq('id', sid)
        .single();

    if (error) {
        console.error("❌ Submission fetch error:", error);
        return;
    }

    const { data: responses, error: responsesError } = await supabase
        .from('test_responses')
        .select(`
            selected_answer,
            is_correct,
            question:questions(id, question, correct_answer, explanation, subject)
        `)
        .eq('submission_id', sid);

    if (responsesError) {
        console.error("❌ Responses fetch error:", responsesError);
    }

    console.log(`📊 Responses found: ${responses?.length}`);

    const incorrect_responses = (responses || [])
        .filter(r => !r.is_correct)
        .map(r => ({
            selected_answer: r.selected_answer,
            question_text: r.question?.question,
            correct_answer: r.question?.correct_answer,
            explanation: r.question?.explanation,
            subject: r.question?.subject
        }));

    const correct_responses = (responses || [])
        .filter(r => r.is_correct)
        .map(r => ({
            selected_answer: r.selected_answer,
            question_text: r.question?.question,
            correct_answer: r.question?.correct_answer,
            explanation: r.question?.explanation,
            subject: r.question?.subject
        }));

    console.log(`❌ Incorrect Count: ${incorrect_responses.length}`);
    console.log(`✅ Correct Count: ${correct_responses.length}`);

    if (incorrect_responses.length > 0) {
        console.log("📝 Sample Incorrect:", incorrect_responses[0]);
    }
}

testEndpoint();
