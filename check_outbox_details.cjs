
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkOutboxDetails() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('📬 Checking failed notification_outbox items...');
    
    const { data, error } = await supabase
        .from('notification_outbox')
        .select('id, event_type, recipient_type, status, attempts, last_error, channels, sent_at')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('❌ Error fetching outbox:', error.message);
    } else {
        console.log(`Found ${data.length} failed notifications:`);
        data.forEach(n => {
            console.log(`- [${n.id}] ${n.event_type} (${n.recipient_type})`);
            console.log(`  Channels: ${n.channels}`);
            console.log(`  Error: ${n.last_error}`);
        });
    }
}

checkOutboxDetails().catch(console.error);
