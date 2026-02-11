const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkColumns() {
    const { data, error } = await supabase
        .from('test_submissions')
        .select('*')
        .limit(1);

    if (error) {
        console.error(error);
    } else {
        console.log(Object.keys(data[0] || {}));
    }
}

checkColumns();
