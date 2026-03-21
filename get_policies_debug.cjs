
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function run() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('Fetching active policies...');
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: "SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public'"
  });

  if (error) {
    console.error('Error fetching policies:', error.message);
  } else {
    // exec_sql might return {status: 'success'} but not the data unless it's designed to.
    // Let's try the RPC that returns records if we have it, or just use another exec_sql that builds a string.
    
    const { data: data2, error: error2 } = await supabase.rpc('exec_sql', {
       sql_query: "SELECT json_agg(t)::text FROM (SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public') t"
    });
    
    if (error2) {
       console.error('Error 2:', error2.message);
    } else {
       console.log('Policies JSON:', data2);
    }
  }
}

run().catch(console.error);
