const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    console.log('--- Checking Submission 1 ---');
    const { data: sub } = await supabase.from('test_submissions').select('*').eq('id', 1).single();
    console.log('Submission 1:', JSON.stringify(sub, null, 2));

    console.log('\n--- Checking Responses for Submission 1 ---');
    const { data: responses, error } = await supabase
        .from('test_responses')
        .select(`
            id,
            selected_answer,
            is_correct,
            question_id,
            question:questions(id, question, correct_answer, explanation)
        `)
        .eq('submission_id', 1)
        .eq('is_correct', false);

    if (error) {
        console.error('ERROR:', error);
    } else {
        console.log(`Found ${responses.length} incorrect responses.`);
        responses.forEach((r, i) => {
            console.log(`\n[${i + 1}] Question ID: ${r.question_id}`);
            console.log(`    Selected: ${r.selected_answer}`);
            console.log(`    Has Question Content: ${!!r.question?.question}`);
            if (i === 0) console.log(`    Sample Question TEXT: ${r.question?.question?.substring(0, 50)}...`);
        });
    }

    console.log('\n--- Checking Tutor Profile (Shashi) ---');
    const { data: profile } = await supabase.from('profiles').select('*').eq('email', 'shashikumaredula@gmail.com').single();
    console.log('Profile Assigned Courses:', profile.assigned_courses);
}
check();
