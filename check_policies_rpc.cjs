
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function run() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('Querying policies...');
  const { data, error } = await supabase.rpc('exec_query', {
    p_query: "SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public'"
  });

  if (error) {
    console.error('RPC Error:', error.message);
  } else {
    console.log('Policies:', JSON.stringify(data, null, 2));
  }
}

run().catch(console.error);
