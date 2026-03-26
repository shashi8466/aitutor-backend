import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const userId = 'aa859e7e-6f0c-4038-aaea-aad9f76ab80f';
  const email = 'hemanthkumarreddy700@gmail.com';
  
  console.log(`Trying to manually create profile for ${email} (${userId})...`);
  
  const { data, error } = await supabase
    .from('profiles')
    .insert([{
        id: userId,
        email: email,
        name: 'hemanth',
        role: 'student'
    }])
    .select();

  if (error) {
    console.error('❌ Insert Error:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ Profile Created Successfully:', JSON.stringify(data, null, 2));
  }
}

run();
