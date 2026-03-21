const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'SCRUBBED_KEY';

async function main() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Connecting to Supabase...');
    
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .ilike('question', '%k + 12 = 336%')
      .limit(1);

    if (error) throw error;
    
    if (!data || data.length === 0) {
      console.log('Question not found in DB');
      return;
    }

    const q = data[0];
    console.log('ID:', q.id);
    console.log('Explanation present:', !!q.explanation);
    if (q.explanation) {
        console.log('--- Explanation Start ---');
        console.log(q.explanation);
        console.log('--- Explanation End ---');
    }
  } catch (e) {
    console.error('CAUGHT ERROR:', e);
  }
}

main();
