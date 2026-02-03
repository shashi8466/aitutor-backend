// Test script to demonstrate the improved topic extraction

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
SAT_TOPICS.sort((a, b) => b.length - a.length);

// Test cases from your latest screenshots
const testCases = [
    {
        input: "Q.1) Geometry & Trigonometry Area and volume , The area of a rectangle is 2400 square centimeters. The width of the rectangle is 80 centimeters. What is the length, in centimeters, of this rectangle?",
        expected: {
            topic: "Geometry & Trigonometry - Area and volume",
            question: "The area of a rectangle is 2400 square centimeters. The width of the rectangle is 80 centimeters. What is the length, in centimeters, of this rectangle?"
        }
    },
    {
        input: "Q.2) Geometry & Trigonometry Right triangles and trigonometry, In the figure shown, which of the following is equal to cos?(x^° ) ?",
        expected: {
            topic: "Geometry & Trigonometry - Right triangles and trigonometry",
            question: "In the figure shown, which of the following is equal to cos?(x^° ) ?"
        }
    },
    {
        input: "Q.3) Algebra Linear functions , The product of p and 5 is q less than 8 . Which equation represents the relationship between p and q?",
        expected: {
            topic: "Algebra - Linear functions",
            question: "The product of p and 5 is q less than 8 . Which equation represents the relationship between p and q?"
        }
    }
];

// Simulate the parser logic (UPDATED with whitespace normalization)
function parseQuestion(line) {
    const questionMatch = line.match(/^(\d+[.)\s]|Q\.?\d+[:.)]?|Question\s*\d+[:.)]?)\s*(.*)/i);

    if (questionMatch) {
        // Exact logic from parser.js
        let qText = questionMatch[2].replace(/\s+/g, ' ').trim();
        let detectedTopic = "";

        // Check if this text starts with a known topic
        const topicInQuestion = SAT_TOPICS.find(t => qText.startsWith(t));
        if (topicInQuestion) {
            detectedTopic = topicInQuestion;
            qText = qText.substring(topicInQuestion.length).replace(/^[,\s.:-]+/, '').trim();

            // Check for sub-topic
            const subTopic = SAT_TOPICS.find(t => qText.startsWith(t));
            if (subTopic && subTopic !== topicInQuestion) {
                detectedTopic = `${topicInQuestion} - ${subTopic}`;
                qText = qText.substring(subTopic.length).replace(/^[,\s.:-]+/, '').trim();
            }
        }

        return { topic: detectedTopic || null, question: qText };
    }

    return { topic: null, question: line };
}

console.log('🧪 Testing Hierarchical Topic Extraction\n');
console.log('='.repeat(80));

testCases.forEach((testCase, index) => {
    console.log(`\nTest Case ${index + 1}:`);
    console.log('-'.repeat(80));
    console.log('INPUT:');
    console.log(`  ${testCase.input.substring(0, 100)}...`);

    const result = parseQuestion(testCase.input);

    console.log('\nEXPECTED:');
    console.log(`  Topic: "${testCase.expected.topic}"`);
    console.log(`  Question: "${testCase.expected.question.substring(0, 80)}..."`);

    console.log('\nACTUAL:');
    console.log(`  Topic: "${result.topic}"`);
    console.log(`  Question: "${result.question.substring(0, 80)}..."`);

    const topicMatch = result.topic === testCase.expected.topic;
    const questionMatch = result.question === testCase.expected.question;

    console.log('\nRESULT:');
    console.log(`  Topic: ${topicMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Question: ${questionMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log('='.repeat(80));
});

console.log('\n✨ Test Complete!\n');
