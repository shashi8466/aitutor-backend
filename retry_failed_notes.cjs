
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function retryFailed() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('🔄 Attempting to retry failed notifications...');
    
    const { data: failed, error } = await supabase
        .from('notification_outbox')
        .update({
            status: 'pending',
            attempts: 0,
            last_error: 'Retrying manually'
        })
        .eq('status', 'failed')
        .gte('created_at', '2026-03-20T00:00:00') // Recent only
        .select();

    if (error) {
        console.error('❌ Error updating outbox:', error.message);
    } else if (failed) {
        console.log(`✅ Reset ${failed.length} notifications to pending.`);
    }
}
retryFailed();
