
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const adminSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SAT_TOPICS = [
  "Craft and Structure", "Information and Ideas", "Standard English Conventions",
  "Expression of Ideas", "Words in Context", "Command of Evidence", "Inferences",
  "Central Ideas and Details", "Text Structure", "Purpose", "Algebra", "Advanced Math",
  "Rhetorical synthesis", "Text Structure and Purpose", "Transitions", "Boundaries",
  "Form, Structure, and Sense", "Cross-Text Connections", "Textual Evidence",
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
  console.log('🚀 Starting Global Database Format Correction (All rows)...');

  let allQuestions = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: questions, error: fetchError } = await adminSupabase
      .from('questions')
      .select('id, question, topic')
      .range(from, from + step - 1);

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return;
    }

    if (questions.length > 0) {
      allQuestions = allQuestions.concat(questions);
      from += step;
    } else {
      hasMore = false;
    }
  }

  console.log(`Processing ${allQuestions.length} questions...`);

  let count = 0;
  for (const q of allQuestions) {
    let originalText = q.question || "";
    let cleanedText = originalText.trim();
    let detectedTopic = q.topic || "";

    // 1. Remove Question Numbering (Q.1, Question 1, etc.)
    const qNumRegex = /^(\d+[.)\s]|Q\.?\d+[:.)]?|Question\s*\d+[:.)]?)\s*/i;
    if (qNumRegex.test(cleanedText)) {
      cleanedText = cleanedText.replace(qNumRegex, '').trim();
    }

    // 2. Extract Topic if it's still in the text
    for (const topic of SAT_TOPICS) {
      const topicRegex = new RegExp(`^${topic}[\\s.:-]+`, 'i');
      if (topicRegex.test(cleanedText)) {
         // Some questions might have a general "topic" but the text contains a more specific subtopic.
         // Let's overwrite detectedTopic if it's more specific.
        if (!detectedTopic || detectedTopic.length < topic.length) {
            detectedTopic = topic;
        }
        cleanedText = cleanedText.replace(topicRegex, '').trim();
        break;
      }
    }

    // 3. Extra check for "and Purpose" leftovers
    if (cleanedText.toLowerCase().startsWith('and purpose')) {
        detectedTopic = "Text Structure and Purpose";
        cleanedText = cleanedText.replace(/^and Purpose\s*/i, '').replace(/^[,\s.:-]+/, '').trim();
    }
    
    // 3.5 Check for "Words in context"
    if (cleanedText.toLowerCase().startsWith('words in context')) {
        detectedTopic = "Words in Context";
        cleanedText = cleanedText.replace(/^words in context\s*/i, '').replace(/^[,\s.:-]+/, '').trim();
    }

    // 4. Clean leading punctuation
    cleanedText = cleanedText.replace(/^[,\s.:-]+/, '').trim();

    // 5. Update if changed
    if (cleanedText !== originalText.trim() || detectedTopic !== q.topic) {
      const { error: updateError } = await adminSupabase
        .from('questions')
        .update({
          question: cleanedText,
          topic: detectedTopic || null
        })
        .eq('id', q.id);

      if (!updateError) {
         count++;
      }
      else console.error(`Error updating ID ${q.id}:`, updateError.message);
    }
  }

  console.log(`✅ Global Correctness Complete! Updated ${count} questions.`);
}

cleanAllQuestions();
