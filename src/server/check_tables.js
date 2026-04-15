import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://wqavuacgbawhgcdxxzom.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzE4MTIsImV4cCI6MjA4MDg0NzgxMn0.X2jOfdw4umwJ8Bxl_vG_EjAVboyblrV89HWDEnX15R4');

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); // If a custom RPC exists
  // Alternatively just try querying common tables
  const tables = ['questions', 'kb_questions', 'sat_questions'];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (!error) console.log(`Table '${t}' has ${count} rows.`);
    else console.log(`Table '${t}' error: ${error.message}`);
  }
}

listTables();
