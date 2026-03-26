import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Checking for active triggers on auth.users...');
  // Querying pg_trigger to find on_auth_user_created or similar
  // Since we might not have access, I'll try to find a trigger by name 
  // via a SELECT that usually works for service role
  const { data, error } = await supabase.rpc('get_trigger_info', { trigger_name: 'on_auth_user_created' });
  
  if (error) {
     console.log('Trigger RPC failed, trying to check for existence of handle_new_user function...');
     const { data: func, error: err2 } = await supabase
       .from('pg_proc')
       .select('proname')
       .eq('proname', 'handle_new_user');
     
     if (err2 || !func.length) {
         console.log('❌ handle_new_user function NOT found. Run SUPABASE_ULTRA_SAFE_PROFILE_TRIGGER.sql');
     } else {
         console.log('✅ handle_new_user function exists.');
     }
  } else {
    console.log('Trigger Info:', JSON.stringify(data, null, 2));
  }
}

run();
