
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

async function verifyAndSaveSendGrid() {
    // 1. PAST YOUR SENDGRID API KEY HERE:
    const SENDGRID_API_KEY = "PASTE_YOUR_API_KEY_HERE";
    const FROM_EMAIL = "ssky57771@gmail.com";

    if (SENDGRID_API_KEY === "PASTE_YOUR_API_KEY_HERE" || !SENDGRID_API_KEY) {
        console.error("❌ You must edit this file and paste your SendGrid API Key!");
        return;
    }

    console.log("Verifying SendGrid API Key...");
    try {
        const resp = await fetch('https://api.sendgrid.com/v3/scopes', {
            headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` }
        });

        if (!resp.ok) {
            console.error("❌ SendGrid API Key is INVALID! Status:", resp.status);
            return;
        }
        
        console.log("✅ SendGrid API Key is valid!");

        // 2. Save it to Supabase DB so Render Backend can use it
        console.log("Saving API Key to database...");
        const s = createClient(url, serviceKey);
        
        const { data: current } = await s.from('internal_settings').select('id, email_config').limit(1).single();
        if (!current) { console.log("No settings found"); return; }
        
        const updated = {
            ...current.email_config,
            sendgrid_api_key: SENDGRID_API_KEY,
            from_email: FROM_EMAIL,
            enabled: true
        };
        
        const { error } = await s.from('internal_settings')
            .update({ email_config: updated })
            .eq('id', current.id);
            
        if (error) {
            console.error("❌ Failed to update Database:", error.message);
        } else {
            console.log(`✅ SUCCESS! Your platform will now send emails via SendGrid using ${FROM_EMAIL}`);
        }

    } catch (err) {
        console.error("❌ Check Failed:", err.message);
    }
}

verifyAndSaveSendGrid().catch(console.error);
