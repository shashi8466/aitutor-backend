import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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
SAT_TOPICS.sort((a, b) => b.length - a.length);

const normalizeForTopic = (str) => {
    return str.replace(/\\\(|\\\)|\\\[|\\\]/g, '').replace(/[,\s.:-]+/g, ' ').trim().toLowerCase();
};

async function fixQuestions() {
    console.log('🛠 Starting Comprehensive Database Fix...');

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
        let isModified = false;
        let newQuestion = q.question || '';
        let newTopic = q.topic;
        let newOptions = [...(q.options || [])];
        let newExplanation = q.explanation || '';

        // 1. Fix Double Wrapping \( \( ... \) \) and stray delimiters
        const fixDoubleWrapping = (text) => {
            if (!text) return text;
            let lastText;
            let currentText = text;

            // Fix literal mistakes like "\ ( \" or "\ ) \"
            currentText = currentText.replace(/\\ \(/g, '\\(').replace(/\\ \)/g, '\\)');

            do {
                lastText = currentText;
                // Remove redundant nested delimiters
                currentText = currentText.replace(/\\\(\s*\\\(/g, '\\(');
                currentText = currentText.replace(/\\\)\s*\\\)/g, '\\)');
            } while (currentText !== lastText);

            return currentText;
        };

        const oldQ = newQuestion;
        newQuestion = fixDoubleWrapping(newQuestion);
        newExplanation = fixDoubleWrapping(newExplanation);
        newOptions = newOptions.map(opt => fixDoubleWrapping(opt));
        if (newQuestion !== oldQ) isModified = true;

        // 2. Extract Topic and Clean Question Text
        let cleanText = newQuestion.replace(/^(\d+[.)\s]|Q\.?\d+[:.)]?|Question\s*\d+[:.)]?)\s*/i, '').trim();

        const normText = normalizeForTopic(cleanText);
        const detectedTopic = SAT_TOPICS.find(t => normText.startsWith(t.toLowerCase()));

        if (detectedTopic) {
            if (!newTopic || newTopic === 'null' || newTopic === '') {
                newTopic = detectedTopic;
            } else if (!newTopic.toLowerCase().includes(detectedTopic.toLowerCase())) {
                newTopic = `${newTopic} - ${detectedTopic}`;
            }

            let topicEndIndex = -1;
            let currentTest = "";
            for (let charIdx = 0; charIdx < cleanText.length; charIdx++) {
                currentTest += cleanText[charIdx];
                if (normalizeForTopic(currentTest) === detectedTopic.toLowerCase()) {
                    topicEndIndex = charIdx + 1;
                    break;
                }
            }
            if (topicEndIndex !== -1) {
                cleanText = cleanText.substring(topicEndIndex).replace(/^[,\s.:-]+/, '').trim();
                newQuestion = cleanText;
                isModified = true;
            }
        } else if (newQuestion !== cleanText) {
            newQuestion = cleanText;
            isModified = true;
        }

        // 3. Fix Clumped Options (REFINED)
        if (newOptions.length > 0) {
            const allOptionsText = newOptions.join(' ');

            // Lenient regex for markers
            const markerRegex = /(\\?\(?\s*\\?text\{\s*[A-D]\s*[):.-]*\}\s*\)?\\?|\\?\(?\s*[A-D]\s*[):.-]+\s*|\\?\(?\s*[A-D]\s*[\):.-]*\s*\)?\\?[\s.):-]*\s*)/i;
            const parts = allOptionsText.split(markerRegex);

            if (parts.length > 1) {
                let extractedOptions = new Array(4).fill("");

                // If parts[0] has content, it's likely Option A
                if (parts[0].trim().length > 1) {
                    extractedOptions[0] = parts[0].trim();
                }

                for (let j = 1; j < parts.length; j += 2) {
                    const marker = parts[j];
                    const content = (parts[j + 1] || "").trim();
                    const letterMatch = marker.match(/[A-D]/i);
                    if (letterMatch) {
                        const letter = letterMatch[0].toUpperCase();
                        const idx = letter.charCodeAt(0) - 65;
                        if (idx >= 0 && idx < 4) {
                            extractedOptions[idx] = content;
                        }
                    }
                }

                const finalOpts = extractedOptions.filter(o => o !== "");
                if (finalOpts.length >= 2) {
                    if (JSON.stringify(finalOpts) !== JSON.stringify(q.options)) {
                        newOptions = finalOpts;
                        isModified = true;
                    }
                }
            }
        }

        // 4. Update Database
        if (isModified) {
            const { error: updateError } = await supabase
                .from('questions')
                .update({
                    question: newQuestion,
                    topic: newTopic,
                    options: newOptions,
                    explanation: newExplanation
                })
                .eq('id', q.id);

            if (updateError) console.error(`❌ Failed Q${q.id}:`, updateError.message);
            else fixedCount++;
        }
    }

    console.log(`✅ COMPLETE! Fixed ${fixedCount} questions.`);
}

fixQuestions();
