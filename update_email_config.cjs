
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

async function updateEmailConfig() {
    const s = createClient(url, serviceKey);
    
    // Fetch current settings
    const { data: current } = await s.from('internal_settings').select('id, email_config').limit(1).single();
    if (!current) { console.log("No settings found"); return; }

    const updated = {
        ...current.email_config,
        enabled: true,
        host: 'mail.gigatechservices.org',
        port: 465,
        secure: true,
        user: 'notifications@gigatechservices.org',
        pass: 'Pu$gm;p)$7O+IzCb',
        from_email: 'notifications@gigatechservices.org'
    };

    const { error } = await s.from('internal_settings')
        .update({ email_config: updated })
        .eq('id', current.id);

    if (error) console.error("❌ Update Error:", error.message);
    else console.log("✅ Email credentials updated successfully in DB.");
}

updateEmailConfig().catch(console.error);
