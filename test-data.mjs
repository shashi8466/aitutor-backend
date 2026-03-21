import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzE4MTIsImV4cCI6MjA4MDg0NzgxMn0.X2jOfdw4umwJ8Bxl_vG_EjAVboyblrV89HWDEnX15R4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkData() {
  console.log("\nChecking Profiles (Roles)...");
  const { data: profiles, error: profileError } = await supabase.from('profiles').select('*').limit(5);
  console.log(profiles || profileError);

  console.log("\nChecking Test Submissions (Score Reports)...");
  const { data: subs, error: subError } = await supabase.from('test_submissions').select('*').limit(5);
  console.log(subs || subError);
}

checkData();
