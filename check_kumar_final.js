
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const studentEmail = 'ssky57771@gmail.com';
    
    // 1. Get User
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error("Auth error:", authError);
        return;
    }
    
    const user = users.find(u => u.email === studentEmail);
    if (!user) {
        console.log("User not found by email:", studentEmail);
        return;
    }
    
    const studentId = user.id;
    console.log("Found student ID:", studentId);

    // 2. Get Diagnostic Score (Floor)
    const { data: planData, error: planError } = await supabase
        .from('student_learning_plan')
        .select('diagnostic_data')
        .eq('student_id', studentId)
        .single();
    
    if (planError) console.log("Plan error (might be empty):", planError.message);
    else console.log("Diagnostic Data:", JSON.stringify(planData.diagnostic_data, null, 2));

    // 3. Get Submissions
    const { data: submissions, error: subError } = await supabase
        .from('test_submissions')
        .select('id, course_id, level, raw_score_percentage, scaled_score, created_at')
        .eq('student_id', studentId);
    
    if (subError) console.error("Submissions error:", subError);
    else {
        console.log("\nSubmissions:");
        console.table(submissions);
    }

    // 4. Get Progress
    const { data: progress, error: progError } = await supabase
        .from('student_progress')
        .select('id, course_id, level, score')
        .eq('student_id', studentId);
    
    if (progError) console.error("Progress error:", progError);
    else {
        console.log("\nProgress (Lessons):");
        console.table(progress);
    }
}

run();
