import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY // Testing with ANON key
);

async function run() {
  console.log('Testing connection with ANON key to courses table...');
  const { data, error } = await supabase
    .from('courses')
    .select('name')
    .limit(1);

  if (error) {
    console.error('❌ Connection failed with ANON key:', error.message);
  } else {
    console.log('✅ Connection OK with ANON key. Found course:', data[0]?.name || 'None');
  }
}

run();
