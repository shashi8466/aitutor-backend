import express from 'express';
import { generateAIResponse, extractJSON } from '../utils/ai.js';
import { handleTutorRequest } from '../utils/tutorAgent.js';
import { getUserFromRequest } from '../utils/authHelper.js';

const router = express.Router();

console.log('🤖 Initializing AI Routes...');

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'AI routes working!', timestamp: new Date().toISOString() });
});

// Route listing endpoint for debugging
router.get('/routes', (req, res) => {
  res.json({
    message: 'Available AI Routes',
    routes: [
      'POST /api/ai/chat',
      'POST /api/ai/explain',
      'POST /api/ai/generate-similar',
      'POST /api/ai/generate-plan',
      'POST /api/ai/review-test',
      'POST /api/ai/quiz-from-content',
      'POST /api/ai/summarize',
      'POST /api/ai/flashcards',
      'POST /api/ai/chapters',
      'POST /api/ai/podcast',
      'POST /api/ai/extract',
      'POST /api/ai/sales-chat',
      'GET /api/ai/test',
      'GET /api/ai/routes'
    ]
  });
});

// 1. Chat
router.post('/chat', async (req, res) => {
  try {
    const { message, context, difficulty } = req.body;
    console.log(`📩 [Chat Route] Received: "${message}" with context: "${context?.substring(0, 50)}..." Difficulty: ${difficulty}`);
    if (context && context.includes('Expert SAT Tutor')) {
      const user = await getUserFromRequest(req);
      if (user) {
        try {
          const tutorRes = await handleTutorRequest(user.id, message, context, difficulty);
          return res.json({ reply: tutorRes.reply });
        } catch (tutorErr) {
          console.error("❌ Tutor Agent Error:", tutorErr);
        }
      }
    }
    const systemPrompt = (context || "You are a helpful AI tutor.") +
      "\n\nLATEX STANDARDS:\n- Use \\\\( ... \\\\) for all math formulas, variables, and values.\n- Use \\\\frac{num}{den} for fractions. NEVER leave arguments empty.\n- NO SPACES in LaTeX commands (e.g. \\\\frac{1}{2}, NOT \\\\frac {1} {2}).";
    const response = await generateAIResponse([
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ]);
    res.json({ reply: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Explain
router.post('/explain', async (req, res) => {
  try {
    const { question, userAnswer, correctAnswer } = req.body;
    const prompt = `
PERSONA: Expert SAT Tutor. 
TASK: Explain why the correct answer is correct and why the student's answer (if wrong) is incorrect.

QUALITY RULES:
1. USE LATEX for ALL math: Wrap every formula, number with unit, or variable in \\\\( ... \\\\).
2. FRACTIONS: Always use \\\\frac{num}{den}. NEVER use incomplete fractions like \\\\frac{num}.
3. NO SPACES in commands: Use \\\\frac{a}{b}, NOT \\\\frac {a} {b}.
4. EXPLANATION STYLE: Use clear, step-by-step SAT logic.

Q:"${question}" 
Student Answer:"${userAnswer}" 
Correct Answer:"${correctAnswer}"

Return JSON ONLY: {"concept": "...", "explanation": "...", "steps": ["..."]}
`;
    const text = await generateAIResponse([{ role: "user", content: prompt }], true);
    res.json(extractJSON(text));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Generate Similar (HARDENED VARIETY VERSION)
router.post('/generate-similar', async (req, res) => {
  try {
    const { question, previousQuestions } = req.body;
    if (!question) return res.status(400).json({ error: "Missing question content" });

    const qStr = typeof question === 'string' ? question : (question.question || JSON.stringify(question));
    const imgRegex = /<div class="question-image"[^>]*>.*?<\/div>|<img[^>]+>/g;
    const originalImages = qStr.match(imgRegex) || [];
    const cleanQStrSource = qStr.replace(imgRegex, '[DIAGRAM PRESENT]');

    const safePreviousQuestions = Array.isArray(previousQuestions) ? previousQuestions : [];
    let avoidanceText = safePreviousQuestions.length > 0 ? `AVOID similarity to: ${safePreviousQuestions.slice(-3).join(', ')}\n\n` : "";

    const forbiddenNumbers = (cleanQStrSource.match(/\d+/g) || []).join(', ');

    // Extract the topic/concept from the original question
    const topicMatch = cleanQStrSource.match(/(?:Topic|Concept|Category)[:\s]+([^,\n]+)/i) ||
      cleanQStrSource.match(/(Geometry|Algebra|Reading|Writing|Math)/i);
    const topic = topicMatch ? topicMatch[1] : "the same topic";

    const prompt = `
${avoidanceText}
PERSONA: Senior SAT Content Developer creating ORIGINAL practice questions.

CRITICAL REQUIREMENTS (ALL MUST BE FOLLOWED):

1. ✅ SAME TOPIC ONLY: Keep the mathematical concept/topic identical (e.g., "Area of rectangle", "Linear equations", "Reading comprehension inference").

2. ❌ DIFFERENT NUMBERS (MANDATORY): 
   - Change EVERY number from the original. If original has 2400, use 1800, 3200, 1500, etc.
   - If original has 80, use 60, 100, 120, etc.
   - FORBIDDEN NUMBERS (DO NOT USE): [${forbiddenNumbers}]
   - Generate completely new numeric values that make sense for the problem.

3. ❌ DIFFERENT UNKNOWN (MANDATORY):
   - If original asks for "length", ask for "width", "perimeter", "area", or "diagonal".
   - If original asks for "x", ask for "y", "slope", "y-intercept", or a different variable.
   - Change what the student is solving for.

4. ❌ DIFFERENT QUESTION FRAMING (MANDATORY):
   - Change the scenario/context (e.g., if original is about a rectangle, use a different shape or real-world context).
   - Change the question structure (e.g., if original is "What is X?", use "Find X such that..." or "Determine the value of X when...").
   - Reword the entire question - do NOT copy sentence structure or phrasing.
   - Use different units or measurements if applicable.

EXAMPLES OF GOOD VARIATIONS:
Original: "The area of a rectangle is 2400 cm². The width is 80 cm. What is the length?"
Good: "A rectangular garden has an area of 1800 square feet. If the length is 60 feet, what is the width in feet?"
Good: "The perimeter of a rectangle is 120 inches. The length is 35 inches. What is the width?"

Original: "Solve for x: 2x + 5 = 15"
Good: "If 3y - 7 = 20, what is the value of y?"
Good: "Find the value of n when 4n + 12 = 28"

LATEX STANDARDS (STRICT):
- Use EXACTLY \\\\frac{num}{den} for all fractions. 
- FORBIDDEN: \\\\frac{num} (missing denominator) or \\\\frac {num} {den} (extra spaces).
- Use \\\\( ... \\\\) for ALL math, including variables like \\\\( x \\\\) or values like \\\\( 30^o \\\\).
- Do NOT use plain text for math.

ORIGINAL QUESTION (USE AS REFERENCE FOR TOPIC ONLY):
"${cleanQStrSource.substring(0, 800)}"

DIFFICULTY LEVEL: ${question.level || "Medium"}
RANDOM SEED: ${Math.random().toString(36).substring(7)}

OUTPUT FORMAT (JSON ONLY):
{
  "question": "Completely new question text with different numbers, unknown, and framing... [DIAGRAM]",
  "options": ["Val 1", "Val 2", "Val 3", "Val 4"],
  "correctAnswer": "Val 1",
  "explanation": "Expert SAT logic...",
  "concept": "${topic}"
}
`;

    // --- IMPROVED SIMILARITY CHECK ---
    const checkSimilarity = (genText, origText) => {
      const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normOrig = norm(origText);
      const normGen = norm(genText);

      // 1. Text cloning check
      if (normGen.includes(normOrig.substring(0, 30)) || normGen === normOrig) {
        return { error: "AI generated a copy." };
      }

      // 2. Numbers check (Ignore 0-9 as they are often exponents or basic constants)
      const genNums = (genText.match(/\d+/g) || []).map(n => parseInt(n)).filter(n => n > 9);
      const origNums = (origText.match(/\d+/g) || []).map(n => parseInt(n)).filter(n => n > 9);

      const reused = origNums.filter(n => genNums.includes(n));
      const reuseRatio = origNums.length > 0 ? reused.length / origNums.length : 0;

      if (origNums.length > 0 && reuseRatio > 0.5) {
        return { error: `Too many numbers reused (${reused.length} numbers).` };
      }

      // 3. Structural similarity
      const origWords = origText.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const genWords = genText.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const commonLongWords = origWords.filter(w => genWords.includes(w));
      if (commonLongWords.length > origWords.length * 0.6) {
        return { error: "Question structure too similar." };
      }

      return null;
    };

    let attempts = 0;
    let finalData = null;
    let lastCheckError = null;

    while (attempts < 2) {
      attempts++;
      console.log(`🔄 Similar Question Attempt ${attempts}/2...`);

      const text = await generateAIResponse([{ role: "user", content: prompt }], true, 1.0);
      const data = extractJSON(text);

      if (!data || !data.options) {
        lastCheckError = "Invalid AI output";
        continue;
      }

      const simError = checkSimilarity(data.question, cleanQStrSource);
      if (simError) {
        lastCheckError = simError.error;
        console.warn(`⚠️ Attempt ${attempts} rejected: ${simError.error}`);
        continue;
      }

      // Success!
      finalData = data;
      break;
    }

    if (!finalData) {
      throw new Error(lastCheckError || "Failed to generate a sufficiently different question. Please try again.");
    }

    // Replace [DIAGRAM]
    if (finalData.question.includes('[DIAGRAM]')) {
      finalData.question = finalData.question.replace(/\[DIAGRAM\]/g, originalImages[0] || '');
    } else if (originalImages.length > 0 && (finalData.question.toLowerCase().includes('figure') || finalData.question.toLowerCase().includes('shown'))) {
      finalData.question = originalImages[0] + "\n" + finalData.question;
    }

    // --- FINAL SANITIZATION ---
    const sanitized = {
      question: finalData.question || finalData.questionText || finalData.text || "Question text missing",
      options: finalData.options || finalData.choices || [],
      correctAnswer: finalData.correctAnswer || finalData.answer || "",
      explanation: finalData.explanation || finalData.solution || "",
      concept: finalData.concept || question.concept || ""
    };

    res.json(sanitized);
  } catch (error) {
    console.error("❌ Generate Similar Error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-plan', async (req, res) => {
  try {
    const { diagnosticData } = req.body;
    const prompt = `Study plan for: ${JSON.stringify(diagnosticData)}. Return JSON.`;
    const text = await generateAIResponse([{ role: "user", content: prompt }], true);
    res.json(extractJSON(text));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/review-test', async (req, res) => {
  try {
    const { testData } = req.body;

    // Extract and validate scores
    const totalScore = parseInt(testData.score) || 0;
    const mathScore = parseInt(testData.sectionScores?.math) || 0;
    const rwScore = parseInt(testData.sectionScores?.rw) || 0;
    const topicBreakdown = testData.topicBreakdown || [];
    const studentNotes = testData.mistakesText || '';

    // Calculate score analysis
    const scoreDiff = mathScore - rwScore;
    const weakerSection = scoreDiff < 0 ? 'Math' : scoreDiff > 0 ? 'Reading & Writing' : 'Balanced';
    const hasTimeIssues = studentNotes.toLowerCase().includes('time') ||
      studentNotes.toLowerCase().includes('rushed') ||
      studentNotes.toLowerCase().includes('ran out');

    // Build comprehensive SAT expert prompt
    const prompt = `You are an ELITE Digital SAT Test Analyst with 15+ years of experience helping students reach 1500+ scores. Analyze this practice test with SPECIFIC, ACTIONABLE insights.

═══════════════════════════════════════
📊 STUDENT TEST DATA
═══════════════════════════════════════
Total Score: ${totalScore} / 1600
Math Section: ${mathScore} / 800
Reading & Writing: ${rwScore} / 800
Score Gap: ${Math.abs(scoreDiff)} points (${weakerSection} is weaker)

Topic-wise Mistakes: ${topicBreakdown.length > 0 ? topicBreakdown.map(t => `${t.topic}: ${t.mistakes} wrong`).join(', ') : 'Not specified'}

Student Notes: ${studentNotes || 'None provided'}
${hasTimeIssues ? '⚠️ TIME MANAGEMENT ISSUES DETECTED' : ''}

═══════════════════════════════════════
📋 DIGITAL SAT BENCHMARKS (Use for comparison)
═══════════════════════════════════════
• 1550-1600: Ivy League competitive
• 1450-1549: Top 20 universities
• 1350-1449: Top 50 universities  
• 1200-1349: Good state schools
• Below 1200: Needs significant improvement

═══════════════════════════════════════
📝 YOUR ANALYSIS TASK
═══════════════════════════════════════

1️⃣ SCORE INTERPRETATION
- What does this total score mean for college admissions?
- Which section needs more focus based on the ${Math.abs(scoreDiff)}-point gap?
- Is the score distribution healthy or lopsided?

2️⃣ WEAKNESS IDENTIFICATION (Be SPECIFIC)
${topicBreakdown.length > 0 ?
        `- Analyze these weak topics: ${topicBreakdown.map(t => t.topic).join(', ')}
   - Why do these topics matter for Digital SAT?
   - Which has highest ROI to fix first?` :
        `- Infer likely weak areas from the ${weakerSection} being lower
   - For Math gaps: likely Algebra, Problem Solving, or Advanced Math
   - For R&W gaps: likely Reading Comprehension or Standard English Conventions`
      }

3️⃣ STRATEGY ANALYSIS
${hasTimeIssues ?
        `- CRITICAL: Address time management issues mentioned
   - Give specific pacing strategies for Digital SAT (32 min Math, 32 min R&W per module)
   - Suggest skip/guess strategies for hard questions` :
        `- Recommend test-taking strategies based on score pattern
   - Suggest module difficulty preparation (adaptive test awareness)`
      }

4️⃣ ACTION PLAN (Must be SPECIFIC and NUMBERED)
- Give 3-4 concrete next steps
- Include specific topic drills, not generic "practice more"
- Recommend study time allocation

═══════════════════════════════════════
📤 REQUIRED OUTPUT FORMAT (JSON ONLY)
═══════════════════════════════════════
{
  "issue_type": "Primary Issue Category (e.g., 'Math Concept Gaps', 'Reading Speed', 'Time Management', 'Careless Errors')",
  
  "analysis": "2-3 detailed sentences explaining the main finding. Connect scores → weaknesses → impact. Example: 'Your 620 Math score is 30 points below your R&W, indicating Math should be prioritized. The Algebra mistakes suggest foundational gaps in equation solving that are costing you 4-6 questions per section.'",
  
  "breakdown": [
    {
      "category": "Specific category name",
      "status": "Weak" or "Strong" or "Moderate",
      "advice": "1-2 sentence specific advice"
    }
  ],
  
  "next_actions": [
    "Action 1: Specific drill or resource (e.g., 'Complete 20 Algebra equation problems daily using Khan Academy')",
    "Action 2: Specific strategy (e.g., 'Use 2-pass method: answer easy questions first, mark hard ones')",
    "Action 3: Specific timeline (e.g., 'Take next practice test in 7 days to measure progress')"
  ],
  
  "score_summary": "One sentence score interpretation (e.g., 'Your 1250 puts you in the competitive range for Top 50 schools, but you need 100+ more points for Top 20.')",
  
  "priority_order": ["Topic 1 to fix first", "Topic 2", "Topic 3"]
}

CRITICAL: Return ONLY the JSON object. No markdown, no extra text.`;

    console.log('🔍 [Test Review] Analyzing scores:', { totalScore, mathScore, rwScore, topicCount: topicBreakdown.length });

    const text = await generateAIResponse([{ role: "user", content: prompt }], true);
    const result = extractJSON(text);

    console.log('✅ [Test Review] Analysis complete:', result?.issue_type);

    // Ensure all expected fields exist with intelligent fallbacks
    res.json({
      issue_type: result?.issue_type || (mathScore < rwScore ? 'Math Performance Gap' : 'Reading & Writing Focus Needed'),
      analysis: result?.analysis || `Your ${totalScore} score shows ${weakerSection} needs attention. Focus on the ${Math.abs(scoreDiff)}-point gap to maximize improvement.`,
      breakdown: result?.breakdown || [
        { category: 'Math Section', status: mathScore >= rwScore ? 'Strong' : 'Weak', advice: mathScore < rwScore ? 'Prioritize Algebra and Problem Solving drills' : 'Maintain current performance' },
        { category: 'Reading & Writing', status: rwScore >= mathScore ? 'Strong' : 'Weak', advice: rwScore < mathScore ? 'Focus on reading speed and comprehension' : 'Maintain current performance' }
      ],
      next_actions: result?.next_actions || [
        `Focus on ${weakerSection} section with daily 30-minute practice`,
        'Complete 2 full-length timed practice tests this week',
        'Review all incorrect answers and create an error log'
      ],
      score_summary: result?.score_summary || `Your ${totalScore} score is ${totalScore >= 1400 ? 'competitive for top schools' : totalScore >= 1200 ? 'good but has room for improvement' : 'below target - focused practice needed'}.`,
      priority_order: result?.priority_order || [weakerSection, topicBreakdown[0]?.topic || 'General Practice', 'Time Management']
    });
  } catch (error) {
    console.error('❌ Review-test Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/quiz-from-content', async (req, res) => {
  try {
    const { context } = req.body;
    if (!context || typeof context !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid context parameter' });
    }
    const prompt = `Create a 5-question multiple choice quiz based on this text: ${context.substring(0, 3000)}. 
    Return JSON ONLY: {"quiz": [{
  "question": "The actual question text using LaTeX",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "A",
  "explanation": "Step-by-step solution",
  "concept": "Topic name"
}]}

Return ONLY this JSON object.`;

    const text = await generateAIResponse([{ role: "user", content: prompt }], true);
    let parsed = extractJSON(text);

    if (!parsed || !Array.isArray(parsed.quiz) || parsed.quiz.length === 0) {
      throw new Error("AI failed to generate a valid quiz structure with questions.");
    }

    const sanitizedQuiz = parsed.quiz.map(q => {
      if (!q.question && !q.questionText) {
        throw new Error("AI failed to generate a valid question text for one of the quiz items.");
      }
      return {
        question: q.question || q.questionText || "Question text missing",
        options: q.options || q.choices || [],
        correctAnswer: q.correctAnswer || q.answer || "",
        explanation: q.explanation || q.solution || "",
        concept: q.concept || ""
      };
    });

    res.json({ quiz: sanitizedQuiz });
  } catch (error) {
    console.error('❌ Quiz-from-content Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/summarize', async (req, res) => {
  try {
    const { context } = req.body;
    if (!context || typeof context !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid context parameter' });
    }
    const prompt = `Summarize this text in a professional, educational way: ${context.substring(0, 4000)}. Return JSON ONLY: {"summary": "..."}`;
    const text = await generateAIResponse([{ role: "user", content: prompt }], true);
    res.json(extractJSON(text));
  } catch (error) {
    console.error('❌ Summarize Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/flashcards', async (req, res) => {
  try {
    const { context } = req.body;
    if (!context || typeof context !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid context parameter' });
    }
    const prompt = `Create 6 educational flashcards from this text: ${context.substring(0, 4000)}. Return JSON ONLY: {"flashcards": [{"front": "term", "back": "definition"}]}`;
    const text = await generateAIResponse([{ role: "user", content: prompt }], true);
    res.json(extractJSON(text));
  } catch (error) {
    console.error('❌ Flashcards Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/chapters', async (req, res) => {
  try {
    const { context } = req.body;
    if (!context || typeof context !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid context parameter' });
    }
    const prompt = `Break this text into logical chapters: ${context.substring(0, 4000)}. Return JSON ONLY: {"chapters": [{"title": "...", "description": "..."}]}`;
    const text = await generateAIResponse([{ role: "user", content: prompt }], true);
    res.json(extractJSON(text));
  } catch (error) {
    console.error('❌ Chapters Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/podcast', async (req, res) => {
  try {
    const { context } = req.body;
    if (!context || typeof context !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid context parameter' });
    }
    const prompt = `Generate a podcast script for this text: ${context.substring(0, 4000)}. Return JSON ONLY: {"title": "...", "script": "..."}`;
    const text = await generateAIResponse([{ role: "user", content: prompt }], true);
    res.json(extractJSON(text));
  } catch (error) {
    console.error('❌ Podcast Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/extract', async (req, res) => {
  try {
    const { url } = req.body;
    res.json({ text: `Content from ${url}. (Server-side URL extraction is limited). Please use Reader View instead.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sales-chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    const systemPrompt = `
PERSONA: Digital SAT AI Tutor & Expert Admissions Assistant.
ROLE: You are a personal SAT mentor for students and a support assistant for teachers/parents.

GOAL: Confidently answer SAT-related questions, course/plan details, practice test scoring, and study strategies.

CONVERSATION RULES:
1. BE FRIENDLY & PROFESSIONAL: Always start with a helpful, encouraging tone.
2. STUDENT FLOW:
   - If they are a student, identify their level (Have they taken a practice test?).
   - Collect score info (Current score? Target score?).
   - Identify weak areas (Math, Reading/Writing, or Full SAT).
   - RECOMMEND NEXT STEP: Practice test, Personalized study plan, or an SAT course (Basic/Standard/Premium).
3. TEACHER FLOW:
   - Mention classroom support, student progress tracking, and teacher dashboards.
   - Example: "I can help you understand our Digital SAT tools for teachers, including student performance tracking and practice resources."
4. PARENT FLOW:
   - Explain the Digital SAT simply.
   - Focus on score improvement, guidance, and structured study plans.
   - Example: "I can help you choose the right Digital SAT plan for your child and explain how we track progress and improvement."

KNOWLEDGE BASE:
- We offer Digital SAT courses (Basic, Standard, Premium).
- We provide full-length practice tests.
- We offer personalized AI-driven study plans.
- We track student progress and identify weak concepts.

RESPONSE FORMAT: Keep responses concise (2-4 sentences) followed by a helpful question to keep the flow.
`;
    const historyMessages = Array.isArray(history)
      ? history
        .filter(m => (m.text || m.content))
        .slice(-8)
        .map(m => ({
          role: m.sender === 'bot' ? 'assistant' : 'user',
          content: String(m.text || m.content || "").trim()
        }))
        .filter(m => m.content.length > 0)
      : [];

    const messages = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content: String(message || "").trim() }
    ];

    if (!messages[messages.length - 1].content) {
      return res.json({ reply: "How can I help you today with your SAT preparation?" });
    }

    const response = await generateAIResponse(messages);
    res.json({ reply: response || "I'm here to help! Could you please rephrase your question?" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Log all registered routes for debugging
console.log('✅ AI Routes Registered:');
console.log('  POST /api/ai/chat');
console.log('  POST /api/ai/explain');
console.log('  POST /api/ai/generate-similar');
console.log('  POST /api/ai/generate-plan');
console.log('  POST /api/ai/review-test');
console.log('  POST /api/ai/quiz-from-content');
console.log('  POST /api/ai/summarize');
console.log('  POST /api/ai/flashcards');
console.log('  POST /api/ai/chapters');
console.log('  POST /api/ai/podcast');
console.log('  POST /api/ai/extract');
console.log('  POST /api/ai/sales-chat');

export default router;