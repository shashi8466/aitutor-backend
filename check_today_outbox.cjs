
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkToday() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const todayStr = new Date().toISOString().split('T')[0] + 'T00:00:00Z';
    console.log(`📬 Checking notifications since ${todayStr}`);
    
    const { data, error } = await supabase
        .from('notification_outbox')
        .select('id, recipient_type, status, last_error, created_at')
        .gte('created_at', todayStr)
        .order('created_at', { ascending: false });

    if (error) {
        console.warn('Error:', error.message);
    } else {
        console.log(`Found ${data.length} items from today.`);
        data.forEach(n => {
            console.log(`[${n.id}] ${n.recipient_type} status=${n.status} error=${n.last_error}`);
        });
    }
}
checkToday();
