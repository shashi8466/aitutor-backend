
const { createClient } = require('@supabase/supabase-js');
const url = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

async function check() {
    console.log("Checking Table Names...");
    const s = createClient(url, serviceKey);
    
    // Querying information_schema to see all table names in public
    const { data: tables, error } = await s.rpc('get_tables_info', {}); // Might not exist
    
    // If RPC fails, try generic select from information_schema if possible
    // But usually you can't select from information_schema directly via PostgREST easily.
    
    // Let's just try to select from a hypothetical 'notifications' table.
    const { data, error: tableError } = await s.from('notifications').select('count', { count: 'exact', head: true });
    
    if (tableError) {
        console.log("❌ Table 'notifications' does not exist or error:", tableError.message);
    } else {
        console.log("✅ Table 'notifications' exists.");
    }
}

check().catch(console.error);
