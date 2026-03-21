
const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://wqavuacgbawhgcdxxzom.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg');

async function check() {
    console.log("Checking Shiva (Parent)...");
    const { data: p } = await s.from('profiles').select('*').eq('email', 'kssg369@gmail.com').single();
    console.log("Parent Profile:", JSON.stringify(p, null, 2));

    if (p && p.linked_students) {
        console.log("Linked Students Array:", p.linked_students);
        console.log("Checking Kumar (Student)...");
        const { data: students } = await s.from('profiles').select('*').in('id', p.linked_students);
        console.log("Found students:", JSON.stringify(students, null, 2));
    } else {
        console.log("No linked students found in profile data.");
    }
}

check().catch(console.error);
