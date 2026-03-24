
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

async function check() {
    const s = createClient(url, serviceKey);
    console.log("Checking DB internal_settings for Email override...");
    const { data: settings } = await s.from('internal_settings').select('*').limit(1);
    
    if (settings && settings[0]) {
        console.log("Database Settings Found:");
        const cfg = settings[0].email_config || {};
        console.log(`- Enabled: ${cfg.enabled}`);
        console.log(`- Host: ${cfg.host}`);
        console.log(`- User: ${cfg.user}`);
        console.log(`- Pass: ${cfg.pass ? '✅ SET' : '❌ NOT SET'}`);
    } else {
        console.log("No override settings in database. Using .env files.");
    }
}

check().catch(console.error);
