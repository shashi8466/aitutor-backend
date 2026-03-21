
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const adminSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function countQuestions() {
  const { count, error } = await adminSupabase
    .from('questions')
    .select('*', { count: 'exact', head: true });
  
  if (error) console.error(error);
  else console.log(`Total questions in database: ${count}`);
}

countQuestions();
