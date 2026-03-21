
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function inspectTable() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('🔍 Inspecting internal_settings table...');
    
    const { data, error } = await supabase.rpc('exec_sql', { 
        sql_query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'internal_settings';" 
    });

    if (error) {
        console.error('❌ Error inspecting table via RPC:', error.message);
    } else {
        console.log('RPC Result:', data);
        if (Array.isArray(data)) {
            data.forEach(c => console.log(`- ${c.column_name} (${c.data_type})`));
        } else {
           console.log('Data is not an array.');
        }
    }
    
    console.log('\n🔍 Trying direct query...');
    const { data: data2, error: error2 } = await supabase.from('internal_settings').select('*').limit(1);
    if (error2) {
        console.error('❌ Direct query failed:', error2.message);
    } else {
        console.log('Row 1 exists:', !!data2[0]);
        if (data2[0]) {
            console.log('Row 1 keys:', Object.keys(data2[0]));
        }
    }
}

inspectTable().catch(console.error);
