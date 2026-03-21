import supabase from './src/supabase/supabaseAdmin.js';

async function checkOutbox() {
    console.log('--- LATEST 10 OUTBOX ENTRIES ---');
    const { data, error } = await supabase
        .from('notification_outbox')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching outbox:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('Outbox is empty.');
    } else {
        data.forEach(item => {
            console.log(`ID: ${item.id.substring(0, 8)} | Type: ${item.event_type} | Recipient: ${item.recipient_type} | Status: ${item.status} | Created: ${item.created_at}`);
            console.log(`- Channels: ${JSON.stringify(item.channels)}`);
            console.log(`- Last Error: ${item.last_error || 'None'}`);
            console.log('---');
        });
    }
}

checkOutbox();
