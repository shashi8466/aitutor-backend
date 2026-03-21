
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
    // try to get profiles
    const { data: profiles, error } = await supabase.from('profiles').select('id, email, name');
    
    let studentId = null;
    let email = 'ssky57771@gmail.com';
    if (profiles) {
        const kumar = profiles.find(p => p.email === email || (p.name && p.name.toLowerCase().includes('kumar')));
        if (kumar) {
          studentId = kumar.id;
          email = kumar.email;
        }
    }

    if (!studentId) {
       console.log("Could not find student in profiles, trying auth admin...");
       const { data: { users } } = await supabase.auth.admin.listUsers();
       const u = users.find(u => u.email === email);
       if (u) studentId = u.id;
    }

    if (!studentId) {
        console.log("Student not found.");
        return;
    }

    console.log("Found student ID:", studentId);

    const { data: plan } = await supabase.from('student_learning_plan').select('*').eq('student_id', studentId);
    console.log("Diagnostic Data:", JSON.stringify(plan[0]?.diagnostic_data, null, 2));

    const { data: submissions } = await supabase.from('test_submissions').select('id, course_id, level, raw_score_percentage, scaled_score, math_percentage, math_scaled_score').eq('student_id', studentId);
    console.log("Submissions:");
    console.table(submissions);
    
    const { data: progress } = await supabase.from('student_progress').select('id, course_id, level, score').eq('student_id', studentId);
    console.log("Progress:");
    console.table(progress);

})();
