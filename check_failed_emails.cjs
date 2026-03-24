
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

async function check() {
    const s = createClient(url, serviceKey);
    const { data: outbox } = await s.from('notification_outbox').select('recipient_profile_id').eq('last_error', 'email_failed').limit(5);
    const ids = [...new Set(outbox.map(i => i.recipient_profile_id))];
    
    if (ids.length === 0) {
        console.log("No recent 'email_failed' records found.");
        return;
    }

    const { data: profiles } = await s.from('profiles').select('id, email, name').in('id', ids);
    console.log("Profiles with email_failed:");
    profiles.forEach(p => console.log(`- ${p.name} (${p.email}) [ID: ${p.id}]`));
}

check().catch(console.error);
