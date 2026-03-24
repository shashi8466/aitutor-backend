
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

async function check() {
    const s = createClient(url, serviceKey);
    const { data: outbox } = await s.from('notification_outbox').select('*').contains('payload', { submissionId: 83 }).limit(1);
    if (outbox && outbox[0]) {
        console.log("Full Record for Submission 83:");
        console.log(JSON.stringify(outbox[0], null, 2));
    }
}

check().catch(console.error);
