import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔌 Connected to Supabase:', process.env.VITE_SUPABASE_URL?.substring(0, 30) + '...');


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
    "Lines, angles, and triangles", "Right triangles and trigonometry", "Circles"
];

// Sort by length (longest first) to match longer topics first
SAT_TOPICS.sort((a, b) => b.length - a.length);

/**
 * Extract topic from question text if it exists at the beginning
 * Handles hierarchical topics like "Geometry & Trigonometry Area and volume"
 */
function extractTopicFromQuestion(questionText) {
    if (!questionText) return { topic: null, cleanQuestion: questionText };

    // Remove markdown topic formatting if present
    const markdownTopicMatch = questionText.match(/^\*\*Topic:\s*([^*]+)\*\*\s*\n\n(.+)$/s);
    if (markdownTopicMatch) {
        return {
            topic: markdownTopicMatch[1].trim(),
            cleanQuestion: markdownTopicMatch[2].trim()
        };
    }

    // Check if question starts with any known topic
    for (const mainTopic of SAT_TOPICS) {
        if (questionText.startsWith(mainTopic)) {
            // Extract the remaining text after the main topic
            let remaining = questionText.substring(mainTopic.length);

            // Remove leading separators: comma, period, colon, dash, spaces
            remaining = remaining.replace(/^[,\s.:-]+/, '').trim();

            // Check if there's a sub-topic at the start of remaining text
            let detectedTopic = mainTopic;
            for (const subTopic of SAT_TOPICS) {
                if (subTopic !== mainTopic && remaining.startsWith(subTopic)) {
                    // Found a sub-topic, combine them
                    detectedTopic = `${mainTopic} - ${subTopic}`;
                    // Remove the sub-topic from remaining text
                    remaining = remaining.substring(subTopic.length).replace(/^[,\s.:-]+/, '').trim();
                    break;
                }
            }

            // If there's actual question text remaining, we found a match
            if (remaining.length > 0) {
                return {
                    topic: detectedTopic,
                    cleanQuestion: remaining
                };
            }
        }
    }

    return { topic: null, cleanQuestion: questionText };
}

async function fixExistingQuestions() {
    console.log('🔧 Starting to fix existing questions...\n');

    try {
        // Fetch all questions
        const { data: questions, error } = await supabase
            .from('questions')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.error('❌ Error fetching questions:', error);
            return;
        }

        console.log(`📊 Found ${questions.length} questions to process\n`);

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const question of questions) {
            try {
                // Skip if already has a topic field set
                if (question.topic) {
                    console.log(`⏭️  Question ${question.id}: Already has topic "${question.topic}", skipping`);
                    skippedCount++;
                    continue;
                }

                // Extract topic from question text
                const { topic, cleanQuestion } = extractTopicFromQuestion(question.question);

                if (topic) {
                    // Update the question
                    const { error: updateError } = await supabase
                        .from('questions')
                        .update({
                            topic: topic,
                            question: cleanQuestion
                        })
                        .eq('id', question.id);

                    if (updateError) {
                        console.error(`❌ Error updating question ${question.id}:`, updateError);
                        errorCount++;
                    } else {
                        console.log(`✅ Question ${question.id}: Extracted topic "${topic}"`);
                        console.log(`   Original: ${question.question.substring(0, 80)}...`);
                        console.log(`   Cleaned:  ${cleanQuestion.substring(0, 80)}...\n`);
                        updatedCount++;
                    }
                } else {
                    console.log(`⚪ Question ${question.id}: No topic found in question text`);
                    skippedCount++;
                }
            } catch (err) {
                console.error(`❌ Error processing question ${question.id}:`, err);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📈 SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Questions:  ${questions.length}`);
        console.log(`✅ Updated:       ${updatedCount}`);
        console.log(`⏭️  Skipped:       ${skippedCount}`);
        console.log(`❌ Errors:        ${errorCount}`);
        console.log('='.repeat(60));

    } catch (err) {
        console.error('❌ Fatal error:', err);
    }
}

// Run the migration
fixExistingQuestions()
    .then(() => {
        console.log('\n✨ Migration complete!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n💥 Migration failed:', err);
        process.exit(1);
    });
