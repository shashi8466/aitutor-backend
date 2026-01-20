const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
    try {
        // 1. Get a submission with incorrect questions
        const { data: subs, error: subsError } = await supabase
            .from('test_submissions')
            .select('id, incorrect_questions')
            .not('incorrect_questions', 'eq', '{}')
            .limit(1);

        if (subsError || !subs || subs.length === 0) {
            console.log('No submissions with incorrect questions found');
            return;
        }

        const subId = subs[0].id;
        console.log(`Diagnosing submission ID: ${subId}`);
        console.log(`Incorrect question IDs in submission:`, subs[0].incorrect_questions);

        // 2. Check test_responses for this submission
        const { data: responses, error: respError } = await supabase
            .from('test_responses')
            .select('*')
            .eq('submission_id', subId);

        if (respError) {
            console.error('Error fetching test_responses:', respError.message);
        } else {
            console.log(`Found ${responses.length} responses for this submission.`);
            const incorrectFromResp = responses.filter(r => r.is_correct === false);
            console.log(`Incorrect responses found (by is_correct=false): ${incorrectFromResp.length}`);
            if (incorrectFromResp.length > 0) {
                console.log('Sample incorrect response:', incorrectFromResp[0]);
            }
        }

        // 3. Test the join query specifically
        const { data: joinData, error: joinError } = await supabase
            .from('test_responses')
            .select(`
                selected_answer,
                is_correct,
                questions(question_text, correct_answer, explanation)
            `)
            .eq('submission_id', subId)
            .eq('is_correct', false);

        if (joinError) {
            console.error('Join query failed:', joinError.message);
            console.error('Full error:', JSON.stringify(joinError, null, 2));
        } else {
            console.log(`Join query returned ${joinData.length} rows.`);
            if (joinData.length > 0) {
                console.log('Sample join row:', JSON.stringify(joinData[0], null, 2));
            }
        }

    } catch (e) {
        console.error('Unexpected error:', e);
    }
}

diagnose();
