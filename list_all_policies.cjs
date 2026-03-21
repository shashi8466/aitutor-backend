
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function listPolicies() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('Listing all RLS policies...');
  
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_query: `
      SELECT 
          schemaname, 
          tablename, 
          policyname, 
          permissive, 
          roles, 
          cmd, 
          qual, 
          with_check 
      FROM pg_policies 
      WHERE schemaname = 'public';
    `
  });

  if (error) {
    // If exec_sql doesn't work, try a different approach
    console.log('exec_sql failed, trying direct query if possible...');
    const { data: data2, error: error2 } = await supabase.from('pg_policies').select('*'); // This won't work usually
    console.error('Error:', error.message);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

listPolicies().catch(console.error);
