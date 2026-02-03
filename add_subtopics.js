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

// Sort by length (longest first)
SAT_TOPICS.sort((a, b) => b.length - a.length);

// Map of main topics to their possible sub-topics
const TOPIC_HIERARCHY = {
    "Geometry & Trigonometry": [
        "Area and volume",
        "Lines, angles, and triangles",
        "Right triangles and trigonometry",
        "Circles"
    ],
    "Geometry and Trigonometry": [
        "Area and volume",
        "Lines, angles, and triangles",
        "Right triangles and trigonometry",
        "Circles"
    ],
    "Algebra": [
        "Linear equations in one variable",
        "Linear equations in two variables",
        "Linear functions",
        "Systems of two linear equations",
        "Linear inequalities"
    ],
    "Advanced Math": [
        "Nonlinear functions",
        "Quadratic equations",
        "Exponential functions",
        "Polynomials",
        "Radicals",
        "Rational exponents"
    ],
    "Craft and Structure": [
        "Words in Context",
        "Text Structure",
        "Purpose"
    ],
    "Information and Ideas": [
        "Command of Evidence",
        "Inferences",
        "Central Ideas and Details"
    ],
    "Expression of Ideas": [],
    "Standard English Conventions": [],
    "Problem-Solving and Data Analysis": [
        "Ratios, rates, proportional relationships",
        "Percentages",
        "One-variable data",
        "Two-variable data",
        "Probability",
        "Conditional probability",
        "Inference from sample statistics",
        "Evaluating statistical claims"
    ]
};

/**
 * Try to find sub-topic in the original question text
 */
async function addSubTopicsToQuestions() {
    console.log('🔧 Adding sub-topics to topic field...\n');

    try {
        // Fetch all questions with their original question text from a backup or re-parse
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
                const currentTopic = question.topic;

                if (!currentTopic) {
                    console.log(`⏭️  Question ${question.id}: No topic set, skipping`);
                    skippedCount++;
                    continue;
                }

                // Check if topic already has a sub-topic (contains " - ")
                if (currentTopic.includes(' - ')) {
                    console.log(`⏭️  Question ${question.id}: Already has sub-topic "${currentTopic}"`);
                    skippedCount++;
                    continue;
                }

                // Get possible sub-topics for this main topic
                const possibleSubTopics = TOPIC_HIERARCHY[currentTopic] || [];

                if (possibleSubTopics.length === 0) {
                    console.log(`⏭️  Question ${question.id}: No sub-topics available for "${currentTopic}"`);
                    skippedCount++;
                    continue;
                }

                // Try to find a sub-topic in the question text
                // We need to check the ORIGINAL question before it was cleaned
                // For now, we'll use a heuristic: check if any sub-topic appears near the start

                let foundSubTopic = null;

                // Check in question text (might have remnants)
                for (const subTopic of possibleSubTopics) {
                    if (question.question && question.question.toLowerCase().includes(subTopic.toLowerCase())) {
                        foundSubTopic = subTopic;
                        break;
                    }
                }

                if (foundSubTopic) {
                    const newTopic = `${currentTopic} - ${foundSubTopic}`;

                    const { error: updateError } = await supabase
                        .from('questions')
                        .update({ topic: newTopic })
                        .eq('id', question.id);

                    if (updateError) {
                        console.error(`❌ Error updating question ${question.id}:`, updateError);
                        errorCount++;
                    } else {
                        console.log(`✅ Question ${question.id}: Updated topic`);
                        console.log(`   From: "${currentTopic}"`);
                        console.log(`   To:   "${newTopic}"\n`);
                        updatedCount++;
                    }
                } else {
                    console.log(`⚪ Question ${question.id}: Could not determine sub-topic for "${currentTopic}"`);
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

// Run the update
addSubTopicsToQuestions()
    .then(() => {
        console.log('\n✨ Sub-topic update complete!');
        console.log('🔄 Please refresh your browser to see the full topic names.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n💥 Update failed:', err);
        process.exit(1);
    });
