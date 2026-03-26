
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

async function check() {
    const s = createClient(url, serviceKey);
    const { data: outbox, error: outError } = await s.from('notification_outbox').select('*').limit(1);
    console.log("Outbox Error:", outError ? outError.message : "None");
    if (outbox) console.log("Outbox Columns:", Object.keys(outbox[0] || {}));
    
    const { data: notifications, error: notiError } = await s.from('notifications').select('*').limit(1);
    console.log("Notifications Error:", notiError ? notiError.message : "None");
    if (notifications) console.log("Notifications Columns:", Object.keys(notifications[0] || {}));
}

check().catch(console.error);
