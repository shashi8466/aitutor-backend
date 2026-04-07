import supabase from './src/supabase/supabaseAdmin.js';

async function checkTopicLevels() {
    console.log('Checking levels for topic "One-variable data Distributions"...');
    const { data, error } = await supabase
        .from('questions')
        .select('topic, level')
        .ilike('topic', '%One-variable data%')
        .limit(10);
        
    if (error) {
        console.error(error);
    } else {
        data.forEach(row => {
            console.log(`Topic: "${row.topic}" | Level: "${row.level}"`);
        });
    }
}

checkTopicLevels();
