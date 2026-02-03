import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
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
// Sort by length (descending) to match longest topics first
SAT_TOPICS.sort((a, b) => b.length - a.length);

async function cleanDatabase() {
    console.log('🧹 STARTING ULTIMATE CLEANUP...');

    // 1. Fetch ALL questions
    const { data: questions, error } = await supabase
        .from('questions')
        .select('*');

    if (error) {
        console.error('❌ Error fetching:', error);
        return;
    }

    console.log(`📊 Processing ${questions.length} questions...`);

    let fixedCount = 0;

    for (const q of questions) {
        let originalText = q.question || '';
        let currentTopic = q.topic;
        let newTopic = currentTopic;
        let cleanText = originalText;
        let isModified = false;

        // --- STEP 1: Normalize Text ---
        // Remove "Q.1) " or "5. " prefix to find hidden topics
        // We match common question prefixes
        let textToCheck = originalText.replace(/^(\d+[.)\s]|Q\.?\d+[:.)]?|Question\s*\d+[:.)]?)\s*/i, '');

        // Also remove leading spaces/commas from what's left
        textToCheck = textToCheck.replace(/^[,\s.:-]+/, '').trim();

        // --- STEP 2: Detect Topics ---
        let detectedMain = null;
        let detectedSub = null;

        // Find MAIN topic (Case Insensitive Check)
        for (const t of SAT_TOPICS) {
            if (textToCheck.toLowerCase().startsWith(t.toLowerCase())) {
                detectedMain = t;
                break;
            }
        }

        if (detectedMain) {
            // Remove Main Topic
            let remainder = textToCheck.substring(detectedMain.length).replace(/^[,\s.:-]+/, '').trim();

            // Look for Sub Topic
            for (const t of SAT_TOPICS) {
                if (t !== detectedMain && remainder.toLowerCase().startsWith(t.toLowerCase())) {
                    detectedSub = t;
                    break;
                }
            }

            if (detectedSub) {
                newTopic = `${detectedMain} - ${detectedSub}`;
                cleanText = remainder.substring(detectedSub.length).replace(/^[,\s.:-]+/, '').trim();
                isModified = true;
            } else {
                newTopic = detectedMain;
                cleanText = remainder;
                isModified = true;
            }
        }
        else if (currentTopic) {
            // If we already have a topic, verify if the text contains a SUB-TOPIC we missed
            // e.g. Topic="Geometry", Text="Right triangles..., Question..."

            let remainingText = textToCheck;

            // Check if text starts with current topic (case insensitive)
            // e.g. Topic="Geometry & Trigonometry", Text="Geometry & Trigonometry Right triangles..."
            if (remainingText.toLowerCase().startsWith(currentTopic.toLowerCase())) {
                remainingText = remainingText.substring(currentTopic.length).replace(/^[,\s.:-]+/, '').trim();
                cleanText = remainingText;
                isModified = true;
            }

            // Now check for any other topic at start (likely sub-topic)
            for (const t of SAT_TOPICS) {
                if (t !== currentTopic && remainingText.toLowerCase().startsWith(t.toLowerCase())) {
                    // Found a sub-topic at start of text!
                    // Append it to current topic if not already there
                    if (!currentTopic.includes(t)) {
                        newTopic = `${currentTopic} - ${t}`;
                    }
                    // Remove it from text
                    cleanText = remainingText.substring(t.length).replace(/^[,\s.:-]+/, '').trim();
                    isModified = true;
                    break;
                }
            }
        }

        // --- STEP 3: Update Database ---
        if (isModified && (cleanText !== originalText || newTopic !== currentTopic)) {
            // console.log(`📝 Fixing Q${q.id}:`);
            // console.log(`   OLD Topic: ${currentTopic}`);
            // console.log(`   NEW Topic: ${newTopic}`);
            // console.log(`   OLD Text:  ${originalText.substring(0, 50)}...`);
            // console.log(`   NEW Text:  ${cleanText.substring(0, 50)}...`);

            const { error: updateError } = await supabase
                .from('questions')
                .update({
                    topic: newTopic,
                    question: cleanText
                })
                .eq('id', q.id);

            if (updateError) console.error(`❌ Failed Q${q.id}:`, updateError);
            else fixedCount++;
        }
    }

    console.log('-'.repeat(50));
    console.log(`✅ COMPLETE! Fixed ${fixedCount} questions.`);
    console.log(`You can now refresh your browser.`);
}

cleanDatabase();
