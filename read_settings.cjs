
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function getSettings() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.from('internal_settings').select('*').eq('id', 1).single();
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}
getSettings();
