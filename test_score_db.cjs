require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co',
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'SCRUBBED_KEY'
);
async function check() {
    const { data } = await supabase.from('test_submissions').select('id, raw_score, raw_score_percentage, scaled_score').order('id', { ascending: false }).limit(5);
    console.log(data);
}
check();
