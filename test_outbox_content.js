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
        console.table(data.map(item => ({
            id: item.id.substring(0, 8),
            type: item.event_type,
            recipient: item.recipient_type,
            status: item.status,
            channels: item.channels.join(', '),
            created: item.created_at
        })));
    }
}

checkOutbox();
