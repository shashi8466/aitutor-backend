import supabase from './src/supabase/supabaseAdmin.js';

async function checkKBQuestions() {
    console.log('Checking kb_questions table contents...');
    
    const { data: topics, error } = await supabase
        .from('kb_questions')
        .select('topic, difficulty')
        .limit(50);

    if (error) {
        console.error('Error fetching kb_questions:', error);
        return;
    }

    console.log(`Found ${topics.length} rows.\n`);
    
    // Show unique combinations
    const seen = new Set();
    const uniqueCombos = [];
    
    topics.forEach(row => {
        const key = `${row.topic} | ${row.difficulty}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueCombos.push(row);
        }
    });

    console.log('Available Topic | Difficulty combinations:');
    uniqueCombos.forEach(combo => {
        console.log(`- Topic: "${combo.topic}" | Difficulty: "${combo.difficulty}"`);
    });
}

checkKBQuestions();
