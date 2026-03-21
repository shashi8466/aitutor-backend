const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'SCRUBBED_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkQuestions() {
  const { data, error } = await supabase
    .from('questions')
    .select('id, question, image, explanation, topic')
    .order('id', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching questions:', error);
    return;
  }

  data.forEach(q => {
    console.log(`--- Question ${q.id} ---`);
    console.log('Topic:', q.topic);
    console.log('Question:', q.question.substring(0, 100) + (q.question.length > 100 ? '...' : ''));
    console.log('Image:', q.image);
    console.log('Explanation:', q.explanation ? q.explanation.substring(0, 100) + (q.explanation.length > 100 ? '...' : '') : 'NONE');
    console.log('Has Image in Text:', q.question.includes('<img') || q.question.includes('http'));
  });
}

checkQuestions();
