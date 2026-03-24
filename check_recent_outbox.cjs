
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

async function check() {
    const s = createClient(url, serviceKey);
    console.log("Latest Test Submissions:");
    const { data: subs } = await s.from('test_submissions').select('id, user_id, test_date, course_id').order('test_date', { ascending: false }).limit(3);
    
    for (const sub of subs) {
        console.log(`- Submission: ${sub.id} | Date: ${sub.test_date} | User: ${sub.user_id}`);
        // For each sub, we find any notification payload containing submissionId: sub.id
        const { data: note } = await s.from('notification_outbox').select('*').limit(10);
        const relevantNotes = note.filter(n => String(n.payload?.submissionId) === String(sub.id));
        
        if (relevantNotes && relevantNotes.length > 0) {
            relevantNotes.forEach(n => console.log(`  -> Notification ID: ${n.id} | Status: ${n.status} | Error: ${n.last_error || 'None'}`));
        } else {
            console.log(`  -> ⚠️ No notification found in outbox for this submission!`);
        }
    }

    console.log("\nRecent Outbox Items (Last 5):");
    const { data: recent } = await s.from('notification_outbox').select('*').order('created_at', { ascending: false }).limit(5);
    recent.forEach(n => console.log(`- ID: ${n.id} | Status: ${n.status} | Type: ${n.event_type} | Created: ${n.created_at} | Error: ${n.last_error}`));
}

check().catch(console.error);
