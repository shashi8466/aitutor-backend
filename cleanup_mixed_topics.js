
import supabase from './src/supabase/supabase.js';

const SAT_TOPICS = [
  "Rhetorical synthesis", "Text Structure and Purpose", "Transitions", "Boundaries",
  "Form, Structure, and Sense", "Craft and Structure", "Information and Ideas", 
  "Standard English Conventions", "Expression of Ideas", "Words in Context", 
  "Command of Evidence", "Inferences", "Central Ideas and Details", "Text Structure", "Purpose"
];

async function cleanupQuestions() {
    console.log('🚀 Starting Database Cleanup for Mixed Topics...');

    // 1. Fix "Rhetorical Synthesis" mixed questions
    const { data: rsQuestions, error: rsError } = await supabase
        .from('questions')
        .select('id, question, topic')
        .ilike('question', 'Rhetorical Synthesis%');

    if (rsError) console.error('Error fetching RS questions:', rsError);
    else if (rsQuestions) {
        console.log(`Found ${rsQuestions.length} questions with "Rhetorical Synthesis" in text.`);
        for (const q of rsQuestions) {
            const newQuestion = q.question.replace(/^Rhetorical Synthesis\s*/i, '').trim();
            const newTopic = "Rhetorical synthesis";
            
            const { error: updateError } = await supabase
                .from('questions')
                .update({ question: newQuestion, topic: newTopic })
                .eq('id', q.id);
            
            if (updateError) console.error(`Failed to update ${q.id}:`, updateError);
            else console.log(`✅ Updated ID ${q.id}: Moved "Rhetorical Synthesis" to topic.`);
        }
    }

    // 2. Fix "and Purpose" mixed questions (where topic is "Text Structure")
    const { data: tpQuestions, error: tpError } = await supabase
        .from('questions')
        .select('id, question, topic')
        .ilike('question', 'and Purpose%');

    if (tpError) console.error('Error fetching TP questions:', tpError);
    else if (tpQuestions) {
        console.log(`Found ${tpQuestions.length} questions with "and Purpose" in text.`);
        for (const q of tpQuestions) {
            const newQuestion = q.question.replace(/^and Purpose\s*/i, '').trim();
            const newTopic = "Text Structure and Purpose";
            
            const { error: updateError } = await supabase
                .from('questions')
                .update({ question: newQuestion, topic: newTopic })
                .eq('id', q.id);
            
            if (updateError) console.error(`Failed to update ${q.id}:`, updateError);
            else console.log(`✅ Updated ID ${q.id}: Fixed "Text Structure and Purpose" topic.`);
        }
    }

    // 3. Fix questions that start with any SAT topic but have empty or generic topics
    const { data: anyQuestions, error: anyError } = await supabase
        .from('questions')
        .select('id, question, topic')
        .limit(1000);

    if (anyError) console.error('Error fetching questions:', anyError);
    else if (anyQuestions) {
        let count = 0;
        for (const q of anyQuestions) {
            const trimmedQ = q.question.trim();
            const matchingTopic = SAT_TOPICS.find(t => trimmedQ.toLowerCase().startsWith(t.toLowerCase()));
            
            if (matchingTopic) {
                // If the topic is already matching or more specific, skip
                if (q.topic && q.topic.toLowerCase().includes(matchingTopic.toLowerCase())) {
                    // But we still want to remove the topic from the question text if it's identical
                    const topicRegex = new RegExp(`^${matchingTopic}[\\s.:-]+`, 'i');
                    if (topicRegex.test(trimmedQ)) {
                        const newQuestion = trimmedQ.replace(topicRegex, '').trim();
                        if (newQuestion !== trimmedQ) {
                            await supabase.from('questions').update({ question: newQuestion }).eq('id', q.id);
                            count++;
                        }
                    }
                    continue;
                }

                const topicRegex = new RegExp(`^${matchingTopic}[\\s.:-]+`, 'i');
                const newQuestion = trimmedQ.replace(topicRegex, '').trim();
                
                const { error: updateError } = await supabase
                    .from('questions')
                    .update({ question: newQuestion, topic: matchingTopic })
                    .eq('id', q.id);
                
                if (!updateError) count++;
            }
        }
        console.log(`Cleaned up ${count} additional questions by separating topics.`);
    }

    console.log('✨ Cleanup Complete!');
}

cleanupQuestions();
