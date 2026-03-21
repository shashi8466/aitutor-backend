
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkSent() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('📬 Recent sent notifications:');
    const { data: sent } = await supabase.from('notification_outbox').select('*').eq('status', 'sent').order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(sent, null, 2));

    console.log('\n👤 Recent profiles:');
    const { data: profiles } = await supabase.from('profiles').select('id, name, email, role').order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(profiles, null, 2));
}
checkSent();
