const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkPlans() {
    const { data, error } = await supabase
        .from('student_plans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error fetching plans:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Latest Plan:', JSON.stringify(data[0], null, 2));
    } else {
        console.log('No plans found.');
    }
}

checkPlans();
