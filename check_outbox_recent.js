import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkOutbox() {
    console.log('--- Checking Outbox for Recent Submission ---');
    const { data, error } = await supabase
        .from('notification_outbox')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(`Found ${data.length} outbox entries.`);
        console.table(data.map(item => ({
            id: item.id,
            status: item.status,
            recipient: item.recipient_id,
            type: item.notification_type,
            error: item.error_message
        })));
    }
}

checkOutbox();
