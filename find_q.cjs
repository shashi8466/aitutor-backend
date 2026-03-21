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
      .select('id, question, explanation, topic')
      .order('id', { ascending: false })
      .limit(50);

    if (error) throw error;
    
    data.forEach(q => {
        if (q.question && (q.question.includes('336') || q.question.includes('12'))) {
            console.log(`--- MATCH ID: ${q.id} ---`);
            console.log('Topic:', q.topic);
            console.log('Q:', q.question);
            console.log('Exp Length:', q.explanation ? q.explanation.length : 'null');
            console.log('Exp:', q.explanation ? q.explanation.substring(0, 100) + '...' : 'NONE');
        }
    });
  } catch (e) {
    console.error('CAUGHT ERROR:', e);
  }
}

main();
