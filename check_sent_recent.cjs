
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

async function check() {
    const s = createClient(url, serviceKey);
    const { data: outbox } = await s.from('notification_outbox').select('*').eq('status', 'sent').order('sent_at', { ascending: false }).limit(5);
    console.log("Recently SENT Notifications:");
    outbox.forEach(i => console.log(`- Sent at: ${i.sent_at} | Event: ${i.event_type} | To ID: ${i.recipient_profile_id}`));
}

check().catch(console.error);
