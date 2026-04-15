import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://wqavuacgbawhgcdxxzom.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzE4MTIsImV4cCI6MjA4MDg0NzgxMn0.X2jOfdw4umwJ8Bxl_vG_EjAVboyblrV89HWDEnX15R4');

async function findData() {
  const possibleTables = ['questions', 'kb_questions', 'sat_questions', 'content', 'materials', 'kb_content'];
  for (const table of possibleTables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error && data.length > 0) {
      console.log(`✅ Table '${table}' has data! Topic: ${data[0].topic || data[0].name || 'N/A'}`);
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      console.log(`   Total rows: ${count}`);
    } else if (error) {
      // console.log(`❌ Table '${table}' error: ${error.message}`);
    } else {
      console.log(`⚪ Table '${table}' exists but is empty.`);
    }
  }
}

findData();
