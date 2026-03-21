
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkPolicies() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('Checking current policies on courses and profiles...');
  
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_query: `
      SELECT tablename, policyname, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename IN ('courses', 'profiles') 
      AND schemaname = 'public';
    `
  });

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

checkPolicies().catch(console.error);
