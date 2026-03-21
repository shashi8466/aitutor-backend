
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkOutbox() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('📬 Checking notification_outbox...');
    
    const { data, error } = await supabase
        .from('notification_outbox')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('❌ Error fetching outbox:', error.message);
    } else {
        console.log(`Found ${data.length} recent notifications:`);
        data.forEach(n => {
            console.log(`- [${n.id}] ${n.event_type} (${n.recipient_type}): Status=${n.status}, Attempts=${n.attempts}, Error=${n.last_error}`);
        });
    }
}

checkOutbox().catch(console.error);
