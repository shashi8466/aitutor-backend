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
 * FORCE clean question text by removing ALL topic remnants
 */
function cleanQuestionText(questionText, existingTopic) {
    if (!questionText) return questionText;

    let cleanText = questionText;

    // Remove all SAT topics from the beginning of the question text
    let changed = true;
    while (changed) {
        changed = false;
        for (const topic of SAT_TOPICS) {
            if (cleanText.startsWith(topic)) {
                cleanText = cleanText.substring(topic.length).replace(/^[,\s.:-]+/, '').trim();
                changed = true;
                break;
            }
        }
    }

    return cleanText;
}

async function forceCleanQuestions() {
    console.log('🔧 FORCE CLEANING all question texts...\n');
    console.log('⚠️  This will clean ALL questions, even if they already have topics set.\n');

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
                const originalQuestion = question.question;
                const cleanedQuestion = cleanQuestionText(originalQuestion, question.topic);

                // Only update if the question text actually changed
                if (cleanedQuestion !== originalQuestion) {
                    const { error: updateError } = await supabase
                        .from('questions')
                        .update({
                            question: cleanedQuestion
                        })
                        .eq('id', question.id);

                    if (updateError) {
                        console.error(`❌ Error updating question ${question.id}:`, updateError);
                        errorCount++;
                    } else {
                        console.log(`✅ Question ${question.id}: Cleaned question text`);
                        console.log(`   Topic: "${question.topic || 'None'}"`);
                        console.log(`   Before: ${originalQuestion.substring(0, 80)}...`);
                        console.log(`   After:  ${cleanedQuestion.substring(0, 80)}...\n`);
                        updatedCount++;
                    }
                } else {
                    console.log(`⏭️  Question ${question.id}: Already clean`);
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
        console.log(`✅ Cleaned:       ${updatedCount}`);
        console.log(`⏭️  Already Clean:  ${skippedCount}`);
        console.log(`❌ Errors:        ${errorCount}`);
        console.log('='.repeat(60));

    } catch (err) {
        console.error('❌ Fatal error:', err);
    }
}

// Run the force clean
forceCleanQuestions()
    .then(() => {
        console.log('\n✨ Force clean complete!');
        console.log('🔄 Please restart your dev server and refresh your browser.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n💥 Force clean failed:', err);
        process.exit(1);
    });
