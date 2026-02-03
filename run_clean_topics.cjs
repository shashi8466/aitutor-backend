/**
 * Migration Script: Clean Topic Names from Question Text
 * 
 * This script removes topic names that appear at the beginning of question text
 * and ensures they are only stored in the 'topic' field.
 * 
 * Run with: node run_clean_topics.cjs
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

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
    if (!str) return '';
    return str
        .replace(/\\(|\\)|\\[|\\]/g, '')
        .replace(/&/g, 'and')
        .replace(/[,\s.:-]+/g, ' ')
        .trim()
        .toLowerCase();
};

const cleanQuestionText = (questionText, topic) => {
    if (!questionText) return questionText;

    let cleanedText = questionText.trim();

    // First, check if there's a colon-based topic (e.g., "Linear equations in two variable:")
    const colonMatch = cleanedText.match(/^([^:]+):\s*(.*)/);
    if (colonMatch) {
        const potentialTopic = colonMatch[1].trim();
        const remainingText = colonMatch[2].trim();

        // Check if this matches any SAT topic (case-insensitive)
        const matchedTopic = SAT_TOPICS.find(t =>
            normalizeForTopic(potentialTopic) === normalizeForTopic(t) ||
            normalizeForTopic(potentialTopic).startsWith(normalizeForTopic(t))
        );

        if (matchedTopic || potentialTopic.length > 5) {
            // If it matches a topic or looks like a topic (> 5 chars), remove it
            return remainingText;
        }
    }

    // If no colon-based topic found, try to find and remove topic from the beginning
    // Check each SAT topic (already sorted by length, longest first)
    for (const satTopic of SAT_TOPICS) {
        const normalizedQuestion = normalizeForTopic(cleanedText);
        const normalizedTopic = normalizeForTopic(satTopic);

        if (normalizedQuestion.startsWith(normalizedTopic)) {
            // Find the exact character position where the topic ends
            let charCount = 0;
            let normalizedSoFar = '';

            for (let i = 0; i < cleanedText.length; i++) {
                normalizedSoFar = normalizeForTopic(cleanedText.substring(0, i + 1));

                // Check if we've matched the full topic
                if (normalizedSoFar === normalizedTopic ||
                    normalizedSoFar.startsWith(normalizedTopic + ' ')) {
                    charCount = i + 1;
                    break;
                }
            }

            if (charCount > 0) {
                // Remove the topic and any following separators
                cleanedText = cleanedText.substring(charCount).replace(/^[,\s.:-]+/, '').trim();

                // Check for sub-topic in remaining text
                for (const subTopic of SAT_TOPICS) {
                    if (subTopic === satTopic) continue;

                    const normalizedRemaining = normalizeForTopic(cleanedText);
                    const normalizedSubTopic = normalizeForTopic(subTopic);

                    if (normalizedRemaining.startsWith(normalizedSubTopic)) {
                        let subCharCount = 0;
                        let subNormalizedSoFar = '';

                        for (let i = 0; i < cleanedText.length; i++) {
                            subNormalizedSoFar = normalizeForTopic(cleanedText.substring(0, i + 1));

                            if (subNormalizedSoFar === normalizedSubTopic ||
                                subNormalizedSoFar.startsWith(normalizedSubTopic + ' ')) {
                                subCharCount = i + 1;
                                break;
                            }
                        }

                        if (subCharCount > 0) {
                            cleanedText = cleanedText.substring(subCharCount).replace(/^[,\s.:-]+/, '').trim();
                        }
                        break;
                    }
                }
                break;
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
