
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyNuclearFix() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const sqlPath = path.join(__dirname, 'NUCLEAR_RLS_FIX.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying NUCLEAR RLS FIX via exec_sql RPC...');
  
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_query: sqlContent
  });

  if (error) {
    console.error('RPC Error:', error.message);
  } else {
    console.log('RPC Response:', JSON.stringify(data, null, 2));
    if (data.status === 'error') {
      console.error('SQL Execution Error:', data.message);
    } else {
      console.log('✅ RLS Policies successfully repaired!');
    }
  }
}

applyNuclearFix().catch(console.error);
