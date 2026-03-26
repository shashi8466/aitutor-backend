import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Fetching all RLS policies...');
  // Using a raw query via rpc or just querying pg_policies if possible
  // Since I can't do raw SQL easily without an RPC, I will query the tables and check for 403s with a test user token
  // Or better, I will try to find an RPC that exists. 
  // Most of these projects have a 'exec_sql' or 'get_policies' RPC if I created one before.
  
  const { data, error } = await supabase.rpc('get_rls_policies');
  if (error) {
    // If RPC doesn't exist, try another way
    const { data: pols, error: err2 } = await supabase
      .from('pg_policies') // This might be blocked by RLS of course
      .select('*');
    
    if (err2) {
       console.log('Could not fetch policies via standard methods. Please check manually in SQL editor.');
    } else {
       console.log(JSON.stringify(pols, null, 2));
    }
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Just checking core tables accessibility for a "student" role (simulated)
async function checkAccess() {
    console.log('\n--- Access Check ---');
    const tables = ['profiles', 'courses', 'enrollments', 'test_submissions', 'questions'];
    for (const table of tables) {
        const { error } = await supabase.from(table).select('count').limit(1);
        if (error) {
            console.log(`❌ ${table}: ${error.message}`);
        } else {
            console.log(`✅ ${table}: Accessible (Admin Role)`);
        }
    }
}

checkAccess();
