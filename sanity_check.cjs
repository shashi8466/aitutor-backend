
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function check() {
  console.log('Starting check...');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('Fetching table counts...');
  const tables = ['courses', 'profiles', 'enrollments', 'test_submissions'];
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Error on ${table}:`, error.message);
    } else {
      console.log(`${table} count:`, count);
    }
  }
}

check().catch(console.error);
