/**
 * Migration Script: Clean Topic Names from Question Text
 * 
 * This script removes topic names that appear at the beginning of question text
 * and ensures they are only stored in the 'topic' field.
 * 
 * Run with: node src/server/migrations/cleanTopicsFromQuestions.js
 */

import supabase from '../../supabase/supabase.js';

const SAT_TOPICS = [
    "Craft and Structure", "Information and Ideas", "Standard English Conventions",
    "Expression of Ideas", "Words in Context", "Command of Evidence", "Inferences",
    "Central Ideas and Details", "Text Structure", "Purpose", "Algebra", "Advanced Math",
    "Linear equations in one variable", "Linear equations in two variables", "Linear functions",
    "Systems of two linear equations", "Linear inequalities", "Nonlinear functions",
    "Quadratic equations", "Exponential functions", "Polynomials", "Radicals",
    "Rational exponents", "Problem-Solving and Data Analysis",
    "Ratios, rates, proportional relationships", "Percentages", "One-variable data",
    "Two-variable data", "Probability", "Conditional probability",
    "Inference from sample statistics", "Evaluating statistical claims",
    "Geometry and Trigonometry", "Geometry & Trigonometry", "Area and volume",
    "Lines, angles, and triangles", "Right triangles and trigonometry", "Circles",
    "Equivalent expressions", "Nonlinear equations in one variable and systems of equations in two variables",
    "in two variables", "in one variable",
    "Ratios rates proportional relationships and units", "Two-variable data: models and scatterplots",
    "Ratios, rates, proportional relationships and units",
    "Problem Solving & Data Analysis", "Systems of two linear equations in two variables",
    "Lines angles and triangles", "in one or two variables"
];

// Sort by length (longest first) to match longer topics first
SAT_TOPICS.sort((a, b) => b.length - a.length);

const normalizeForTopic = (str) => {
    return str.replace(/\\(|\\)|\\[|\\]/g, '').replace(/&/g, 'and').replace(/[,\s.:-]+/g, ' ').trim().toLowerCase();
};

const cleanQuestionText = (questionText, topic) => {
    if (!questionText) return questionText;

    let cleanedText = questionText.trim();
    const normalizedText = normalizeForTopic(cleanedText);

    // Check if the question text starts with a topic
    const topicInQuestion = SAT_TOPICS.find(t => normalizedText.startsWith(t.toLowerCase()));

    if (topicInQuestion) {
        // Find the exact position where the topic ends in the original text
        let topicEndIndex = -1;
        let currentTest = "";

        for (let charIdx = 0; charIdx < cleanedText.length; charIdx++) {
            currentTest += cleanedText[charIdx];
            if (normalizeForTopic(currentTest) === topicInQuestion.toLowerCase()) {
                topicEndIndex = charIdx + 1;
                break;
            }
        }

        if (topicEndIndex !== -1) {
            cleanedText = cleanedText.substring(topicEndIndex).replace(/^[,\s.:-]+/, '').trim();

            // Check for sub-topic
            const normRemainingText = normalizeForTopic(cleanedText);
            const subTopic = SAT_TOPICS.find(t => t !== topicInQuestion && normRemainingText.startsWith(t.toLowerCase()));

            if (subTopic) {
                let subTopicEndIndex = -1;
                let currentSubTest = "";

                for (let charIdx = 0; charIdx < cleanedText.length; charIdx++) {
                    currentSubTest += cleanedText[charIdx];
                    if (normalizeForTopic(currentSubTest) === subTopic.toLowerCase()) {
                        subTopicEndIndex = charIdx + 1;
                        break;
                    }
                }

                if (subTopicEndIndex !== -1) {
                    cleanedText = cleanedText.substring(subTopicEndIndex).replace(/^[,\s.:-]+/, '').trim();
                }
            }
        }
    }

    return cleanedText;
};

const cleanExplanation = (explanation) => {
    if (!explanation) return explanation;

    const lines = explanation.split('\n').filter(line => {
        const trimmed = line.trim();

        // Filter out generic explanations
        const isGeneric = /^Choice\s+[A-E]\s+is\s+(incorrect|correct)\s+(and\s+may\s+result\s+from|This\s+is\s+the\s+value\s+of)/i.test(trimmed) ||
            /^Choice\s+[A-E]\s+is\s+incorrect\.?$/i.test(trimmed) ||
            (trimmed.length < 30 && /incorrect|correct/i.test(trimmed) && !/because|since|as|therefore|thus/i.test(trimmed));

        return !isGeneric;
    });

    return lines.join('\n').trim();
};

async function migrateQuestions() {
    console.log('🔄 Starting migration: Cleaning topics from question text...\n');

    try {
        // Fetch all questions
        const { data: questions, error } = await supabase
            .from('questions')
            .select('*');

        if (error) {
            console.error('❌ Error fetching questions:', error);
            return;
        }

        console.log(`📊 Found ${questions.length} questions to process\n`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const question of questions) {
            const originalQuestion = question.question;
            const cleanedQuestion = cleanQuestionText(originalQuestion, question.topic);

            const originalExplanation = question.explanation;
            const cleanedExplanation = cleanExplanation(originalExplanation);

            const questionChanged = cleanedQuestion !== originalQuestion;
            const explanationChanged = cleanedExplanation !== originalExplanation;

            if (questionChanged || explanationChanged) {
                const updates = {};
                if (questionChanged) updates.question = cleanedQuestion;
                if (explanationChanged) updates.explanation = cleanedExplanation;

                const { error: updateError } = await supabase
                    .from('questions')
                    .update(updates)
                    .eq('id', question.id);

                if (updateError) {
                    console.error(`❌ Error updating question ${question.id}:`, updateError);
                } else {
                    updatedCount++;
                    console.log(`✅ Updated question ${question.id}`);
                    if (questionChanged) {
                        console.log(`   Before: "${originalQuestion.substring(0, 80)}..."`);
                        console.log(`   After:  "${cleanedQuestion.substring(0, 80)}..."`);
                    }
                    if (explanationChanged && originalExplanation && cleanedExplanation !== originalExplanation) {
                        console.log(`   Explanation cleaned`);
                    }
                    console.log('');
                }
            } else {
                skippedCount++;
            }
        }

        console.log('\n✨ Migration complete!');
        console.log(`   Updated: ${updatedCount} questions`);
        console.log(`   Skipped: ${skippedCount} questions (no changes needed)`);

    } catch (err) {
        console.error('❌ Migration failed:', err);
    }
}

// Run the migration
migrateQuestions();
