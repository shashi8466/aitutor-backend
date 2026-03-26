import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Querying all records from welcome_email_queue...');
  const { data, error } = await supabase
    .from('welcome_email_queue')
    .select('*');

  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log('Queue Records:', JSON.stringify(data, null, 2));
}

run();
