
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

async function check() {
    const s = createClient(url, serviceKey);
    console.log("Latest Test Submissions:");
    const { data: subs } = await s.from('test_submissions').select('id, user_id, test_date, course_id').order('test_date', { ascending: false }).limit(5);
    
    for (const sub of subs) {
        console.log(`- Submission: ${sub.id} | Date: ${sub.test_date} | User: ${sub.user_id}`);
        const { data: note } = await s.from('notification_outbox').select('status, last_error').contains('payload', { submissionId: sub.id });
        if (note && note.length > 0) {
            note.forEach(n => console.log(`  -> Notification: ${n.status} | Error: ${n.last_error || 'None'}`));
        } else {
            console.log(`  -> ⚠️ No notification found in outbox for this submission!`);
        }
    }
}

check().catch(console.error);
