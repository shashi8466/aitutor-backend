import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkDataType() {
    const { data, error } = await supabase.rpc('get_table_schema', { tname: 'notification_outbox' });
    if (error) {
        console.log('RPC failed. Trying to insert a test entry to see behavior...');
        const { data: testIns, error: insErr } = await supabase
            .from('notification_outbox')
            .insert({
                event_type: 'TEST_INSERT',
                channels: ['test'], // Array
                recipient_type: 'student',
                status: 'pending'
            })
            .select('*');
        console.log('Insert result channels type:', typeof (testIns?.[0]?.channels));
        console.log('Value:', testIns?.[0]?.channels);
    } else {
        console.log(data);
    }
}

checkDataType();
