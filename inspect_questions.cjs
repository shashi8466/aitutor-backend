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
    console.log('Has Image in Text:', q.question.includes('<img') || q.question.includes('http'));
    if (q.question.includes('<img')) {
        const match = q.question.match(/<img[^>]+src="([^">]+)"/);
        console.log('Image in Text:', match ? match[1] : 'Found tag but no src');
    }
    console.log('Image column:', q.image);
    console.log('------------------------');
  });
}

checkQuestions();
