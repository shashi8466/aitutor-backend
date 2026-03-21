import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkOutboxDetails() {
    const { data: outbox } = await supabase.from('notification_outbox').select('*').limit(5);
    console.log(JSON.stringify(outbox, null, 2));
}

checkOutboxDetails();
