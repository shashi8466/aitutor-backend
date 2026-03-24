
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

async function updateEmailConfigToGmail() {
    const s = createClient(url, serviceKey);
    
    // Fetch current settings
    const { data: current } = await s.from('internal_settings').select('id, email_config').limit(1).single();
    if (!current) { console.log("No settings found"); return; }

    const updated = {
        ...current.email_config,
        enabled: true,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: 'ssky57771@gmail.com',
        pass: 'hxlhrbzchvlugvud',
        from_email: 'ssky57771@gmail.com'
    };

    const { error } = await s.from('internal_settings')
        .update({ email_config: updated })
        .eq('id', current.id);

    if (error) console.error("❌ Update Error:", error.message);
    else console.log("✅ DB Email config updated to use Gmail!");
    
    // Also reset recent pending/failed outbox
    const { data: list } = await s.from('notification_outbox').select('id').in('status', ['pending', 'failed']).order('created_at', { ascending: false }).limit(6);
    const ids = list.map(i => i.id);
    if (ids.length) {
        await s.from('notification_outbox').update({
            status: 'pending',
            attempts: 0,
            last_error: null,
            scheduled_for: new Date().toISOString()
        }).in('id', ids);
        console.log(`✅ Reset ${ids.length} test completion reports in outbox.`);
    }
}

updateEmailConfigToGmail().catch(console.error);
