import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const email = 'hemanthkumarreddy700@gmail.com';
  console.log(`Checking profile for ${email}...`);
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email);

  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log('Profile found:', JSON.stringify(data, null, 2));
}

run();
