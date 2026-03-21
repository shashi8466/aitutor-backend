
import supabase from './src/supabase/supabase.js';

async function checkQuestions() {
    console.log('Fetching questions with potential mixed topics...');
    
    // Look for questions starting with common topics that might have been missed
    const { data: questions, error } = await supabase
        .from('questions')
        .select('id, question, topic')
        .ilike('question', 'and Purpose%')
        .limit(20);

    if (error) {
        console.error('Error fetching questions:', error);
        return;
    }

    console.log(`Analyzing ${questions.length} questions...\n`);
    
    const missedTopics = [
        "Rhetorical synthesis",
        "Text Structure and Purpose",
        "Text Structure",
        "Purpose",
        "Transitions",
        "Boundaries",
        "Form, Structure, and Sense",
        "Words in Context"
    ];

    questions.forEach(q => {
        console.log(`ID: ${q.id}`);
        console.log(`Topic Field: "${q.topic}"`);
        console.log(`Question: "${q.question.substring(0, 100)}..."`);
        console.log('---');
    });
}

checkQuestions();
