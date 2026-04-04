import supabaseAdmin from './src/supabase/supabaseAdmin.js';

async function checkOutbox() {
    const { data: items, error } = await supabaseAdmin
        .from('notification_outbox')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching outbox:', error.message);
        return;
    }

    console.log('Outbox Items:', JSON.stringify(items, null, 2));
}

checkOutbox();
