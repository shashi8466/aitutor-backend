
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

async function test() {
    console.log("Testing Service Role Key...");
    const s = createClient(url, serviceKey);
    const { data, error } = await s.from('profiles').select('id').limit(1);
    
    if (error) {
        console.error("❌ Service Key Test Failed:", error.message);
    } else {
        console.log("✅ Service Key Test Succeeded! Data fetched.");
    }
}
test().catch(console.error);
