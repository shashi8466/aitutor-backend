
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzE4MTIsImV4cCI6MjA4MDg0NzgxMn0.0wB8XF1_G0SIn4h_n0A9D2M6S7X9V1n1-I15R4';

async function test() {
    console.log("Testing Anon Key...");
    const s = createClient(url, key);
    const { data, error } = await s.from('profiles').select('id').limit(1);
    
    if (error) {
        console.error("❌ Key Test Failed:", error.message);
        if (error.status === 401) console.log("Confirmation: Key is INVALID (401)");
    } else {
        console.log("✅ Key Test Succeeded! Data fetched.");
    }
}
test().catch(console.error);
