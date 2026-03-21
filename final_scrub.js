
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const adminSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SAT_TOPICS = [
  "Craft and Structure", "Information and Ideas", "Standard English Conventions",
  "Expression of Ideas", "Words in Context", "Command of Evidence", "Inferences",
  "Central Ideas and Details", "Text Structure and Purpose", "Text Structure", "Purpose", "Algebra", "Advanced Math",
  "Rhetorical synthesis", "Transitions", "Boundaries",
  "Form, Structure, and Sense", "Cross-Text Connections", "Textual Evidence",
  "Command of textual evidence", "Command of quantitative evidence", "Quantitative evidence",
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

// Sort longest first
SAT_TOPICS.sort((a, b) => b.length - a.length);

async function cleanAllQuestions() {
  console.log('🚀 Starting Final Global Database Format Correction...');

  let allQuestions = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: questions, error } = await adminSupabase
      .from('questions')
      .select('id, question, topic')
      .range(from, from + step - 1);

    if (error) { console.error(error); return; }

    if (questions.length > 0) {
      allQuestions = allQuestions.concat(questions);
      from += step;
    } else {
      hasMore = false;
    }
  }

  let count = 0;
  for (const q of allQuestions) {
    if (!q.question) continue;
    let originalText = q.question;
    let cleanedText = originalText.trim();
    let detectedTopic = q.topic || "";

    // 1. Remove Question Numbering
    const qNumRegex = /^(\d+[.)\s]|Q\.?\d+[:.)]?|Question\s*\d+[:.)]?)\s*/i;
    if (qNumRegex.test(cleanedText)) cleanedText = cleanedText.replace(qNumRegex, '').trim();

    // 2. Extract Topic if it's still in the text
    for (const topic of SAT_TOPICS) {
      const topicRegex = new RegExp(`^${topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[\\s.:-]+|\\n)`, 'i');
      if (topicRegex.test(cleanedText)) {
        if (!detectedTopic || detectedTopic.length < topic.length) detectedTopic = topic;
        cleanedText = cleanedText.replace(topicRegex, '').trim();
        break; 
      }
      
      const topicRegexPlain = new RegExp(`^${topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i');
      if (topicRegexPlain.test(cleanedText)) {
        if (!detectedTopic || detectedTopic.length < topic.length) detectedTopic = topic;
        cleanedText = cleanedText.replace(topicRegexPlain, '').trim();
        break; 
      }
    }

    // 3. Extra special hardcoded checks for problematic fragments
    if (cleanedText.toLowerCase().startsWith('and purpose')) {
        detectedTopic = "Text Structure and Purpose";
        cleanedText = cleanedText.replace(/^and Purpose\s*/i, '').replace(/^[,\s.:-]+/, '').trim();
    }
    if (cleanedText.toLowerCase().startsWith('command of textual evidence')) {
        detectedTopic = "Command of textual evidence";
        cleanedText = cleanedText.replace(/^command of textual evidence\s*/i, '').replace(/^[,\s.:-]+/, '').trim();
    }
    if (cleanedText.toLowerCase().startsWith('command of quantitative evidence')) {
        detectedTopic = "Command of quantitative evidence";
        cleanedText = cleanedText.replace(/^command of quantitative evidence\s*/i, '').replace(/^[,\s.:-]+/, '').trim();
    }
    if (cleanedText.toLowerCase().startsWith('form, structure, and sense')) {
        detectedTopic = "Form, Structure, and Sense";
        cleanedText = cleanedText.replace(/^form, structure, and sense\s*/i, '').replace(/^[,\s.:-]+/, '').trim();
    }

    cleanedText = cleanedText.replace(/^[,\s.:-]+/, '').trim();

    if (cleanedText !== originalText.trim() || detectedTopic !== q.topic) {
      const { error: updateError } = await adminSupabase
        .from('questions')
        .update({ question: cleanedText, topic: detectedTopic || null })
        .eq('id', q.id);

      if (!updateError) count++;
    }
  }

  console.log(`✅ Final Pass Complete! Updated ${count} questions.`);
}

cleanAllQuestions();
