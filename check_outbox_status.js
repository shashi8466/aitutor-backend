import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkOutbox() {
    console.log("Checking last 5 outbox entries...");
    const { data, error } = await supabase
        .from('notification_outbox')
        .select('id, event_type, status, attempts, last_error, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
    
    if (error) {
        console.error("Error fetching outbox:", error);
        return;
    }
    
    data.forEach(item => {
        console.log(`\nID: ${item.id} | Status: ${item.status} | Created: ${item.created_at}`);
        console.log(`Event: ${item.event_type} | Attempts: ${item.attempts}`);
        console.log(`Recipients in Payload:`, item.payload?.recipientEmails || "None (Old Format)");
        if (item.last_error) console.log(`Last Error: ${item.last_error}`);
    });
}

checkOutbox();
