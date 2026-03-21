const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'SCRUBBED_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkQuestionOne() {
  const { data, error } = await supabase
    .from('questions')
    .select('id, question, explanation, topic, image')
    .ilike('question', '%k + 12 = 336%')
    .maybeSingle();

  if (error) {
    console.error('Error fetching question:', error);
    return;
  }

  if (!data) {
    console.log('Question not found');
    return;
  }

  console.log('--- Question Data ---');
  console.log('ID:', data.id);
  console.log('Topic:', data.topic);
  console.log('Question:', data.question);
  console.log('Explanation [Length]:', data.explanation ? data.explanation.length : 'null');
  console.log('Explanation [Full Text]:\n' + data.explanation);
  console.log('Explanation [Last 50 chars]:', data.explanation ? data.explanation.slice(-50) : 'null');
  console.log('Image Column:', data.image);
}

checkQuestionOne();
