import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://wqavuacgbawhgcdxxzom.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg');

async function check() {
  console.log('Counting questions in the database...');
  const { data, error } = await supabase
    .from('questions')
    .select('topic, level');

  if (error) {
    console.error('Error:', error);
  } else {
    const counts = {};
    data.forEach(q => {
      const key = `${q.topic} [${q.level}]`;
      counts[key] = (counts[key] || 0) + 1;
    });
    console.log('TOPIC COUNTS:', Object.entries(counts).sort((a,b) => b[1] - a[1]));
  }
}

check();
