
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkDetailedReports() {
    console.log('--- Detailed Score Report Check ---');
    
    // Check test_responses count
    const { count, error } = await supabase
        .from('test_responses')
        .select('*', { count: 'exact', head: true });
    
    if (error) {
        console.error('Error checking test_responses:', error.message);
    } else {
        console.log(`Total test_responses: ${count}`);
    }

    // Check if the most recent submissions have responses
    const { data: latestSubmissions } = await supabase
        .from('test_submissions')
        .select('id, user_id, test_date')
        .order('test_date', { ascending: false })
        .limit(5);

    if (latestSubmissions) {
        for (const sub of latestSubmissions) {
            const { count: respCount } = await supabase
                .from('test_responses')
                .select('*', { count: 'exact', head: true })
                .eq('submission_id', sub.id);
            
            console.log(`Submission ${sub.id} (Date: ${sub.test_date}): ${respCount} responses recorded.`);
        }
    }
}

checkDetailedReports();
