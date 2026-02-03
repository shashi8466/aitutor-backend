
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

const finalizeQuestion = (q) => {
    if (q.explanation === null) q.explanation = '';
    // Simple check for MCQ
    if (q.options.length >= 2) {
        q.type = 'mcq';
    } else {
        q.type = 'short_answer';
    }
    return q;
};

const parseTextToQuestions = (text) => {
    const questions = [];
    const cleanText = text
        .replace(/\u2013|\u2014|\u2212/g, '-')
        .replace(/\u00F7/g, '/');

    const lines = cleanText.split(/\r?\n/).map(line => line.trim()).filter(line => line);
    let currentQuestion = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect Question Start
        const questionMatch = line.match(/^(\d+[.)\s]|Q\.?\d+[:.)]?|Question\s*\d+[:.)]?)\s*(.*)/i);
        const explicitTopicMatch = line.match(/^Topic:\s*(.*)/i);
        let foundTopicStart = null;

        if (!questionMatch && !explicitTopicMatch) {
            const normalizedLine = normalizeForTopic(line);
            foundTopicStart = SAT_TOPICS.find(t => normalizedLine.startsWith(t.toLowerCase()));
        }

        if (questionMatch || explicitTopicMatch || foundTopicStart) {
            if (currentQuestion) questions.push(finalizeQuestion(currentQuestion));

            let qText = "";
            let detectedTopic = "";

            if (questionMatch) {
                qText = questionMatch[2].trim();
                const normQText = normalizeForTopic(qText);
                const topicInQuestion = SAT_TOPICS.find(t => normQText.startsWith(t.toLowerCase()));
                if (topicInQuestion) {
                    detectedTopic = topicInQuestion;
                    qText = qText.substring(topicInQuestion.length).replace(/^[,\s.:-]+/, '').trim();
                }
            } else if (explicitTopicMatch) {
                detectedTopic = explicitTopicMatch[1].trim();
                qText = line.replace(/^Topic:\s*/i, '').trim();
            } else if (foundTopicStart) {
                detectedTopic = foundTopicStart;
                qText = line.substring(foundTopicStart.length).replace(/^[,\s.:-]+/, '').trim();
            }

            currentQuestion = {
                question: qText || line,
                topic: detectedTopic || null,
                options: [],
                correctAnswer: '',
                explanation: null
            };
            continue;
        }

        if (!currentQuestion) continue;

        const optionMatch = line.match(/^\\?\(?\s*([A-Da-d])\s*\)?\\?[\s.):-]+\s*(.*)/);
        if (optionMatch) {
            currentQuestion.options.push(optionMatch[2].trim());
            continue;
        }

        const inlineOptions = line.match(/(?:\\?\(?\s*([A-D])\s*\)?\\?[\s.):-]+\s*)([^A-D\n\\(]+)/g);
        if (inlineOptions && inlineOptions.length > 1) {
            inlineOptions.forEach(opt => {
                const parts = opt.match(/(?:\\?\(?\s*([A-D])\s*\)?\\?[\s.):-]+\s*)(.*)/);
                if (parts) currentQuestion.options.push(parts[2].trim());
            });
            continue;
        }

        if (currentQuestion.options.length === 0 && !currentQuestion.correctAnswer) {
            currentQuestion.question += ' ' + line;
        } else if (currentQuestion.options.length > 0) {
            const lastOptIdx = currentQuestion.options.length - 1;
            currentQuestion.options[lastOptIdx] += ' ' + line;
        }
    }

    if (currentQuestion) questions.push(finalizeQuestion(currentQuestion));
    return questions;
};

// TEST CASES
const test1 = "Q.11) Linear equations in two variables Jay walks at a speed of 3 miles per hour and runs at a speed of 5 miles per hour. He walks for w hours and runs for r hours for a combined total of 14 miles. Which equation represents this situation? A)3w + 5r = 14";
const test2 = "Q.17) Nonlinear equations in one variable and systems of equations in two variables x + 7 = 10 (x + 7)^2 = y Which ordered pair (x, y) is a solution to the given system of equations? A)(3,100) B)(3,3) C)(3,10) D)(3,70)";

console.log("TEST 1 (Image 2):");
const res1 = parseTextToQuestions(test1);
console.log(JSON.stringify(res1, null, 2));

console.log("\nTEST 2 (Image 5):");
const res2 = parseTextToQuestions(test2);
console.log(JSON.stringify(res2, null, 2));
