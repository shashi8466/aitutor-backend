
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

async function reset() {
    const s = createClient(url, serviceKey);
    console.log("Resetting Submission 83 outbox items...");
    
    // We update anything with submissionId 83 in its payload
    // Note: for safety we use a direct payload equality match or check list
    const { data: list } = await s.from('notification_outbox').select('id, payload').order('created_at', { ascending: false }).limit(20);
    const ids = list.filter(i => String(i.payload?.submissionId) === '83' || String(i.payload?.submission_id) === '83').map(i => i.id);
    
    if (ids.length === 0) {
        console.log("No items found for Submission 83");
        return;
    }

    const { error } = await s.from('notification_outbox').update({
        status: 'pending',
        attempts: 0,
        last_error: null,
        scheduled_for: new Date().toISOString()
    }).in('id', ids);

    if (error) console.error("❌ Reset Error:", error.message);
    else console.log(`✅ Reset ${ids.length} items to pending.`);
}

reset().catch(console.error);
