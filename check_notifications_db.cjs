
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

async function check() {
    console.log("Checking Notification Tables...");
    const s = createClient(url, serviceKey);
    
    console.log("- Checking notification_outbox...");
    const { data: outbox, error: outError } = await s.from('notification_outbox').select('*').limit(5);
    if (outError) console.error("❌ Outbox Error:", outError.message);
    else console.log(`✅ Outbox exists. Found ${outbox.length} recent rows.`);

    console.log("- Checking notification_preferences...");
    const { data: prefs, error: prefError } = await s.from('notification_preferences').select('*').limit(5);
    if (prefError) console.error("❌ Preferences Error:", prefError.message);
    else console.log(`✅ Preferences exists. Found ${prefs.length} rows.`);
}

check().catch(console.error);
