
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function checkSubmissions() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const todayStr = new Date().toISOString().split('T')[0] + 'T00:00:00Z';
    console.log(`📡 Checking submissions since ${todayStr}`);
    
    const { data, error } = await supabase
        .from('test_submissions')
        .select('id, user_id, test_date')
        .gte('created_at', todayStr)
        .order('created_at', { ascending: false });

    if (error) {
        console.warn('Error:', error.message);
    } else {
        console.log(`Found ${data.length} submissions today.`);
        for (const s of data) {
           // For each submission, check if it has outbox items
           const { count } = await supabase.from('notification_outbox').select('*', { count: 'exact', head: true }).contains('payload', { submissionId: s.id });
           console.log(`- Sub ${s.id} (user ${s.user_id}) has ${count} outbox items`);
        }
    }
}
checkSubmissions();
