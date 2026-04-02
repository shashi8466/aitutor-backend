import { generateAIResponse, extractJSON } from './ai.js';
import { getStudentState, updateStudentState } from './studentState.js';
import { getAppSettings } from './settingsHelper.js';
import { searchQuestions } from './satQuestionBank.js';

// ─────────────────────────────────────────────────────────────
//  OPTION SANITIZER
//  Converts any LaTeX in answer options to plain readable text.
//  Applied to every option before it is sent to the student.
// ─────────────────────────────────────────────────────────────
const sanitizeOption = (raw) => {
    if (!raw || typeof raw !== 'string') return raw;
    let t = raw.trim();

    // 1. Strip outer \( \) and \[ \] delimiters
    t = t.replace(/\\\(|\\\)/g, '').replace(/\\\[|\\\]/g, '');

    // 2. \frac{a}{b}  →  a/b  (handle nested braces too)
    const expandFrac = (s) => s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
    for (let i = 0; i < 4; i++) t = expandFrac(t); // repeat for nested fractions

    // 3. \sqrt{x}  →  sqrt(x)
    t = t.replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)');
    t = t.replace(/\\sqrt\s*/g, 'sqrt');

    // 4. Named functions
    t = t.replace(/\\ln\b/g, 'ln');
    t = t.replace(/\\log\b/g, 'log');
    t = t.replace(/\\sin\b/g, 'sin');
    t = t.replace(/\\cos\b/g, 'cos');
    t = t.replace(/\\tan\b/g, 'tan');
    t = t.replace(/\\csc\b/g, 'csc');
    t = t.replace(/\\sec\b/g, 'sec');
    t = t.replace(/\\cot\b/g, 'cot');
    t = t.replace(/\\exp\b/g, 'exp');

    // 5. Greek letters  →  Unicode
    t = t.replace(/\\pi\b/g, 'π');
    t = t.replace(/\\theta\b/g, 'θ');
    t = t.replace(/\\alpha\b/g, 'α');
    t = t.replace(/\\beta\b/g, 'β');
    t = t.replace(/\\gamma\b/g, 'γ');
    t = t.replace(/\\delta\b/g, 'δ');
    t = t.replace(/\\infty\b/g, '∞');

    // 6. Operators
    t = t.replace(/\\cdot\b/g, '×');
    t = t.replace(/\\times\b/g, '×');
    t = t.replace(/\\div\b/g, '÷');
    t = t.replace(/\\pm\b/g, '±');
    t = t.replace(/\\leq\b/g, '≤');
    t = t.replace(/\\geq\b/g, '≥');
    t = t.replace(/\\neq\b/g, '≠');

    // 7. \text{...}  and  \ext{...} (common GPT typo)  →  inner text
    t = t.replace(/\\(?:text|ext)\{([^{}]*)\}/g, '$1');

    // 8. Superscripts:  x^{2}  →  x^2
    t = t.replace(/\^\{([^{}]+)\}/g, '^$1');

    // 9. Subscripts:  x_{n}  →  x_n
    t = t.replace(/_\{([^{}]+)\}/g, '_$1');

    // 10. Remove any remaining LaTeX commands
    t = t.replace(/\\[a-zA-Z]+/g, '');

    // 11. Strip leftover braces
    t = t.replace(/\{|\}/g, '');

    // 12. Collapse whitespace
    t = t.replace(/\s{2,}/g, ' ').trim();

    return t;
};


// ─────────────────────────────────────────────────────────────
//  SHARED PROMPT CONSTANTS
// ─────────────────────────────────────────────────────────────

const LATEX_RULES = `
MATH FORMATTING (MANDATORY):
- Use \\( ... \\) for ALL inline math (variables, numbers with units, formulas).
- Use \\[ ... \\] for display math (separate line equations).
- Use \\frac{num}{den} for fractions. NEVER leave an argument empty.
- NO SPACES in LaTeX commands: \\frac{a}{b} ✓ NOT \\frac {a} {b} ✗.
- Exponents: x^{2}, NOT x^2 when more than one character.
`;

const DIGITAL_SAT_FORMAT_RULES = `
DIGITAL SAT QUESTION FORMAT (STRICTLY FOLLOW):
- Every question MUST be Multiple Choice with exactly 4 options labeled A, B, C, D.
- Options should be plausible — include common student errors as distractors.
- Use authentic SAT phrasing:
  • "Which of the following is equivalent to..."
  • "The system of equations above has no solution when..."
  • "In the given equation, k is a constant. If..."
  • "Which choice best describes the function of..."
  • "Which choice completes the text so that it conforms to the conventions of Standard English?"
  • "Which choice most logically follows the previous sentence?"
- Math questions: Focus on multi-step reasoning, abstraction, and real-world modeling.
- Reading/Writing questions: Focus on transitions, rhetorical synthesis, vocabulary in context.

STRICT PROHIBITIONS (DO NOT VIOLATE):
- ❌ NO simple memorization (e.g., "What is sin 60?", "What is the capital of France?")
- ❌ NO 1-step arithmetic
- ❌ NO fill-in-the-blank for single steps
- ✅ Questions MUST require: variable isolation, substitution, completing the square,
     comparison of functions, inference from text, or syntactic reasoning.
`;

const DIFFICULTY_SPECS = {
    Easy: `
EASY LEVEL SPECS (Score range 400–550):
- 1–2 step problems focusing on foundational concepts.
- Math: Basic arithmetic, direct substitution, one-operation linear equations. No complex systems or abstract constants.
- English: Straightforward vocabulary, clear and simple sentence structures, direct transitions (e.g., 'however', 'for example').
- Distractors: Simple calculation errors or unrelated topics.
- Goal: Test if the student understands the basic definition and application of the concept.`,

    Medium: `
MEDIUM LEVEL SPECS (Score range 550–700):
- 2–3 step problems combining two related concepts.
- Math: Real-world modeling, interpreting graphs/tables, multi-step linear systems, basic quadratic factoring.
- English: Context-dependent vocabulary, compound/complex sentences, nuanced transitions (e.g., 'moreover', 'nonetheless').
- Distractors: Conceptual traps (e.g., area vs. perimeter, slope vs. point).
- Goal: Test if the student can apply concepts to semi-complex scenarios.`,

    Hard: `
HARD LEVEL SPECS (Score range 700–800):
- 4–6 step problems requiring multi-concept synthesis and abstract reasoning.
- Math: Uses abstract constants (k, p, a, b) instead of numbers, completing the square, advanced systems with no/infinite solutions, interpreting complex function transformations, or multi-stage geometry. High degree of algebraic manipulation needed.
- English: Sophisticated/Rare academic vocabulary, subtle rhetorical shifts, complex punctuation (semicolons/dashes), and synthesis across long passages.
- Distractors: Highly plausible "near-miss" answers that require elimination of common high-score traps.
- Goal: Challenge even the strongest students with abstraction and logic.`
};

// ─────────────────────────────────────────────────────────────
//  AGENT 1: SAFETY GUARD
// ─────────────────────────────────────────────────────────────
const safetyGuard = async (message) => {
    const prompt = `Analyze if this student request is safe and maintains academic integrity.
Block "just give me the answer" requests without any attempt shown.
Request: "${message}"
JSON: {"safe": boolean, "reason": "string"}`;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true, 0.3, true);
    return extractJSON(response);
};

// ─────────────────────────────────────────────────────────────
//  AGENT 2: QUICK RESPONSE (small, fast)
// ─────────────────────────────────────────────────────────────
const quickResponseAgent = async (message, appName) => {
    const prompt = `You are a helpful SAT tutor at ${appName}. Give a concise, friendly response (<100 words).
${LATEX_RULES}
User: "${message}"
JSON: {"reply": "..."}`;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true, 0.5, true);
    return extractJSON(response);
};

// ─────────────────────────────────────────────────────────────
//  AGENT 3: GENERAL SAT TUTOR
// ─────────────────────────────────────────────────────────────
const tppSatTutorAgent = async (message, state, appName) => {
    const difficulty = state.preferences?.difficulty || 'Medium';
    const prompt = `You are an elite Digital SAT tutor at ${appName}. Current student difficulty level: ${difficulty}.
${LATEX_RULES}
Provide a helpful, conversational explanation. Use markdown for structure.
User: "${message}"
JSON: {"reply": "conversational_markdown_response"}`;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// ─────────────────────────────────────────────────────────────
//  AGENT 4: DIAGNOSTIC PLANNER
// ─────────────────────────────────────────────────────────────
const tppDiagnosticPlannerAgent = async (message, state, appName) => {
    // Extract duration from message (e.g. "2 weeks", "4 weeks", "1 month")
    const durationMatch = message.match(/(\d+)\s*(day|week|month)/i);
    const numVal = durationMatch ? parseInt(durationMatch[1]) : 2;
    const unit = durationMatch ? durationMatch[2].toLowerCase() : 'week';
    const totalDays = unit === 'month' ? numVal * 30 : unit === 'week' ? numVal * 7 : numVal;
    const difficulty = state.preferences?.difficulty || 'Medium';

    const systemPrompt = `You are an expert Digital SAT study planner at ${appName}.
Create a personalized, day-by-day SAT study plan based on the student's request.
Difficulty level: ${difficulty}.
${LATEX_RULES}

The plan MUST include ALL of the following for each day/phase:
- Specific topic to study (e.g. Linear Equations, Transitions, Geometry)
- Clearly labeled study tasks (reading, notes, concept review)
- Specific practice task (e.g. "Solve 10 algebra problems", "Do 2 SAT reading passages")
- Review sessions every 3–4 days
- A rest/review day at the end of each week

FORMAT the plan using this exact markdown structure:

## SAT Study Plan — [Duration]

### Week 1
**Day 1 — [Topic]**
- Study: [what to read/learn]
- Practice: [specific tasks]
- Goal: [what to achieve]

**Day 2 — [Topic]**
...

**Day 7 — Review & Rest**
- Review all Week 1 topics
- Take a 20-question practice quiz

[Continue for all weeks]

---
### Tips for Success
[3 bullet point tips]

Respond ONLY with valid JSON: {"reply": "<full markdown plan here>"}
DO NOT use placeholder text. Write the complete real plan.`;

    const userMsg = `Create a ${numVal}-${unit} Digital SAT study plan. ${message}`;
    const response = await generateAIResponse([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg }
    ], true, 0.7);

    const parsed = extractJSON(response);
    if (!parsed?.reply || parsed.reply.length < 50 || parsed.reply.includes('markdown_roadmap')) {
        return { reply: response || 'Could not generate study plan. Please try again.' };
    }
    return parsed;
};

// ─────────────────────────────────────────────────────────────
//  AGENT 5: PRACTICE MODE (SAT Quiz Engine) — Core Feature
// ─────────────────────────────────────────────────────────────
const tppWeaknessDrillerAgent = async (message, state, appName) => {
    if (!state.practice_module) {
        state.practice_module = { active: false, quiz_data: null };
    }
    const module = state.practice_module;

    // ── Determine difficulty from user message or saved preference ──
    let difficulty = state.preferences?.difficulty || 'Medium';
    const msgLower = message.toLowerCase();
    if (msgLower.includes('hard')) difficulty = 'Hard';
    else if (msgLower.includes('easy')) difficulty = 'Easy';
    else if (msgLower.includes('medium')) difficulty = 'Medium';

    // ── PHASE 1: Start a new quiz ──
    if (!module.active) {

        // ── Initialise uniqueness tracking (persists in student state) ──
        if (!state.seen_question_texts) state.seen_question_texts = [];

        // ── STEP A: Extract topic + count from user message ──
        const paramPrompt = `The student is requesting SAT practice. Identify:
1. The specific SAT TOPIC (e.g., "Trigonometry", "Linear Equations", "Words in Context", "Transitions", "Quadratics", "Statistics", "Geometry", "Probability")
2. How many questions they want (default: 4, max: 10)

Student message: "${message}"

OUTPUT JSON: {"topic": "Specific SAT topic name", "count": 4}
Rules:
- If vague but math-related → use "Algebra"
- If vague but English-related → use "Reading Comprehension"
- Be specific: "algebra" → "Linear Equations", "trig" → "Trigonometry"
- Never exceed count: 10`;

        const paramRes = await generateAIResponse([{ role: "user", content: paramPrompt }], true, 0.3, true);
        const params = extractJSON(paramRes) || { topic: "Algebra", count: 4 };
        const count = Math.min(Math.max(parseInt(params.count) || 4, 1), 10);

        // ── Step B: Fetch KB examples as STYLE TEMPLATES only (never serve directly) ──
        const kbExamples = searchQuestions(params.topic, 2, difficulty);
        const kbFallback = kbExamples.length === 0
            ? searchQuestions("Linear Equations", 2, difficulty)
            : kbExamples;

        // Format KB examples as style reference for the AI
        const styleExamples = kbFallback.slice(0, 2).map((ex, i) => `
Example ${i + 1} (Source Difficulty: ${ex.difficulty}):
Question: ${ex.text}
Options: ${ex.options.map((o, idx) => `${String.fromCharCode(65 + idx)}) ${o}`).join(' | ')}
Correct: ${ex.correctAnswer}`).join('\n');

        // ── Step C: Build the "already seen" avoidance list ──
        const seenList = state.seen_question_texts.slice(-30); // last 30 questions
        const avoidBlock = seenList.length > 0
            ? `\nDO NOT repeat, rephrase, or reuse ANY of these previously shown questions:\n${seenList.map((t, i) => `${i + 1}. "${t}"`).join('\n')}\n`
            : '';

        // ── Step D: Generate ALL questions fresh via OpenAI ──
        const seed = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
        console.log(`📝 [Tutor] Generating ${count} fresh OpenAI questions | Topic: "${params.topic}" | Difficulty: ${difficulty} | Seed: ${seed}`);

        const genPrompt = `You are a senior Digital SAT question writer for College Board.

GENERATION SEED: ${seed}  (guarantees unique output — use it to vary structure)

TASK: Write exactly ${count} completely NEW Digital SAT questions.
Topic: "${params.topic}"
Difficulty: ${difficulty}

═══════════════════════════════════
STYLE REFERENCE (FORMAT ONLY — do NOT copy content):
${styleExamples}
═══════════════════════════════════

${DIGITAL_SAT_FORMAT_RULES}
${DIFFICULTY_SPECS[difficulty] || DIFFICULTY_SPECS.Medium}
${LATEX_RULES}
${avoidBlock}
═══════════════════════════════════
UNIQUENESS RULES (NON-NEGOTIABLE):
1. Use DIFFERENT numbers, variables, and scenarios for each question.
2. Vary the real-world context: use settings from science, finance, sports, architecture, medicine, cooking, geography — rotate them.
3. Change what is being solved for in each question (e.g., don't always ask for 'x').
4. Each question must have a DIFFERENT structure (setup, framing, phrasing).
5. Options must include plausible SAT-style distractors (common student errors).
6. ⚠️ STRICT DIFFICULTY ADHERENCE: Every question generated MUST strictly match the ${difficulty} difficulty specifications provided above. 
   - If the STYLE REFERENCE examples are NOT ${difficulty} level, you MUST increase/decrease their complexity to reach ${difficulty}.
   - For HARD: Use more abstract constants, more steps, and trickier distractors.
   - For EASY: Keep it simple, direct, and obvious.
   - Do NOT mix difficulties.
═══════════════════════════════════
ANSWER OPTIONS FORMATTING (CRITICAL — READ CAREFULLY):
- Options A, B, C, D must be SHORT, PLAIN, READABLE text.
- ❌ NEVER use LaTeX inside options: no \\frac{}{}, no \\ln, no \\sqrt{} in the options array.
- ✅ Write math in options as plain text:
    • Fractions → use "/" notation: write "ln(2)/5" not "\\frac{\\ln(2)}{5}"
    • Square roots → write "sqrt(3)" not "\\sqrt{3}"
    • Logarithms → write "ln(2)" not "\\ln(2)"
    • Powers → write "x^2" not "x^{2}" in options
    • Pi → write "4π/3" not "\\frac{4\\pi}{3}"
- The question TEXT may use full LaTeX. Options must NOT.
- Keep each option under 30 characters if possible.
═══════════════════════════════════

OUTPUT — return ONLY this JSON, no extra text:
{
  "questions": [
    {
      "id": "q_${seed}_1",
      "text": "Full question text here — use LaTeX \\( ... \\) for math in the question body",
      "options": ["plain text A", "plain text B", "plain text C", "plain text D"],
      "correctAnswer": "A",
      "explanation": "Step-by-step solution."
    }
  ]
}`;

        const genRes = await generateAIResponse([{ role: "user", content: genPrompt }], true, 0.7);
        const genData = extractJSON(genRes);

        if (!genData?.questions || genData.questions.length === 0) {
            return {
                reply: `I couldn't generate questions for "${params.topic}" at ${difficulty} difficulty right now. Please try again or pick a different topic.`
            };
        }

        const finalQuestions = genData.questions.slice(0, count);

        // ── Step E: Store question text snippets to prevent future repeats ──
        finalQuestions.forEach(q => {
            const snippet = (q.text || '').substring(0, 150).replace(/\s+/g, ' ').trim();
            if (snippet && !state.seen_question_texts.includes(snippet)) {
                state.seen_question_texts.push(snippet);
            }
        });

        // Cap the list to avoid state bloat (keep last 60 questions)
        if (state.seen_question_texts.length > 60) {
            state.seen_question_texts = state.seen_question_texts.slice(-60);
        }

        // ── Sanitize all options to plain text before storing & displaying ──
        finalQuestions.forEach(q => {
            if (Array.isArray(q.options)) {
                q.options = q.options.map(sanitizeOption);
            }
        });

        // ── Build quiz state from OpenAI-generated questions ──
        const quizData = { topic: params.topic, difficulty, questions: finalQuestions };
        module.active = true;
        module.quiz_data = quizData;

        // ── Format output — exact Digital SAT spec ──
        const questionBlocks = finalQuestions.map((q, i) => {
            const optionLines = q.options
                .map((o, idx) => `${String.fromCharCode(65 + idx)}) ${o}`)
                .join('\n');
            return `Question ${i + 1}\n${q.text}\n\n${optionLines}`;
        }).join('\n\n');

        return {
            reply:
                `Digital SAT Practice: ${quizData.topic}\n\n` +
                `Level: ${difficulty}\n\n` +
                `${questionBlocks}\n\n` +
                `Reply with answers like: 1A, 2B, 3C, 4D`
        };
    }

    // ── PHASE 2: Grade submitted answers ──
    if (module.active) {
        const quizData = module.quiz_data;

        const answerKey = quizData.questions.map(q => `Q${quizData.questions.indexOf(q) + 1}: ${q.correctAnswer}`).join(', ');

        const gradingPrompt = `You are an expert SAT grader.

Quiz Answer Key: ${answerKey}
Student's Answers: "${message}"
Number of Questions: ${quizData.questions.length}

TASK:
1. Parse the student's answers (format: "1A, 2B, 3C" or "A, B, C" or "1. A  2. B").
2. Compare each answer to the answer key.
3. For wrong answers, identify the likely "SAT distractor trap" the student fell into.

OUTPUT JSON:
{
  "score": <number_correct>,
  "total": ${quizData.questions.length},
  "parsed_answers": ["A", "B", ...],
  "reviews": [
    {
      "q_num": 1,
      "isCorrect": true/false,
      "student_answer": "A",
      "correct_answer": "B",
      "trap": "Brief name of distractor trap (if wrong)",
      "explanation": "1-2 sentence SAT-level feedback."
    }
  ]
}`;

        const gradingRes = await generateAIResponse([{ role: "user", content: gradingPrompt }], true, 0.3);
        const results = extractJSON(gradingRes);

        if (!results || !results.reviews) {
            return { reply: "I couldn't parse your answers. Please use the format **1A, 2B, 3C...**" };
        }

        // ── Build score report ──
        const pct = Math.round((results.score / results.total) * 100);
        const grade = pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good work!' : 'Keep practicing!';

        let report = `Quiz Results — ${quizData.topic} (${quizData.difficulty})\n\n`;
        report += `Score: ${results.score} / ${results.total} (${pct}%) — ${grade}\n\n`;
        report += `Review:\n\n`;

        results.reviews.forEach((r, i) => {
            const q = quizData.questions[i];
            const correctOption = r.correct_answer || (q?.correctAnswer);
            const correctText = q?.options?.[correctOption.charCodeAt(0) - 65] || correctOption;

            report += `Q${i + 1}: `;
            if (r.isCorrect) {
                report += `Correct ✓\n`;
            } else {
                report += `Wrong ✗  →  Correct answer: ${correctOption}) ${correctText}\n`;
                if (r.trap) report += `Trap: ${r.trap}\n`;
            }
            if (r.explanation) report += `${r.explanation}\n`;
            report += '\n';
        });

        if (pct < 70) {
            report += `Try the same topic again, or ask me to "explain [topic]" for a concept review.`;
        } else {
            report += `Great work! Try Hard difficulty or a new topic. Ask "quiz me on [topic]" to continue.`;
        }

        module.active = false; // End quiz
        return { reply: report };
    }
};

// ─────────────────────────────────────────────────────────────
//  AGENT 6: DOUBT SOLVER
// ─────────────────────────────────────────────────────────────
const tppDoubtSolverAgent = async (message, state, appName) => {
    const difficulty = state.preferences?.difficulty || 'Medium';
    const systemPrompt = `You are a patient, expert Digital SAT tutor at ${appName}. 
Difficulty level: ${difficulty}.
${LATEX_RULES}
Instructions:
- Provide a clear, thorough, step-by-step explanation in markdown.
- Use headers, bullet points, and numbered steps where helpful.
- Show worked examples with actual numbers.
- Highlight common SAT traps and mistakes students make.
- End with a 1-sentence tip or memory trick.

Respond ONLY with valid JSON: {"reply": "<your full markdown explanation here>"}
DO NOT use placeholder text. Write the real explanation content inside the reply string.`;

    const response = await generateAIResponse([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Explain this SAT concept clearly: ${message}` }
    ], true, 0.7);
    const parsed = extractJSON(response);
    // Safety: if AI still returns a placeholder or empty reply, fall back to raw response
    if (!parsed?.reply || parsed.reply.length < 20 || parsed.reply.includes('detailed_markdown')) {
        return { reply: response || 'Could not generate explanation. Please try again.' };
    }
    return parsed;
};

// ─────────────────────────────────────────────────────────────
//  AGENT 7: PARENT REPORTER
// ─────────────────────────────────────────────────────────────
const tppParentReporterAgent = async (message, state, appName) => {
    const prompt = `You are a progress reporting agent at ${appName}.
Summarize the student's session state for a parent or guardian.
State: ${JSON.stringify(state)}
JSON: {"reply": "formatted_parent_report_markdown"}`;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// ─────────────────────────────────────────────────────────────
//  AGENT 8: TEST ANALYST
// ─────────────────────────────────────────────────────────────
const tppTestAnalystAgent = async (message, state, appName) => {
    const prompt = `You are an expert SAT test analyst at ${appName}.
Known error patterns: ${JSON.stringify(state.error_patterns || {})}.
User request: "${message}"
JSON: {"reply": "detailed_analysis_markdown"}`;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// ─────────────────────────────────────────────────────────────
//  AGENT 9: STRUCTURED TEACHER
// ─────────────────────────────────────────────────────────────
const tppStructuredTeacherAgent = async (message, state, appName) => {
    if (!state.teaching_module) state.teaching_module = { active: false, step: 'INIT', topic: '' };
    const module = state.teaching_module;

    // ── Step 1: First call — store the original topic and ask for mode ──
    if (!module.active) {
        module.active = true;
        module.step = 'WAIT_FOR_MODE';
        // Extract and remember the topic from the user's message
        module.topic = message.replace(/^(explain|learn|study|teach me|what is|how to|tell me about)/i, '').trim() || message;
        return {
            reply: `Let's study **${module.topic}**! How would you like to learn?\n\n` +
                `1. Step-by-step explanation\n` +
                `2. Quick quiz on the topic\n\n` +
                `Just type 1 or 2.`
        };
    }

    // ── Step 2: User replied with "1" or "2" ──
    if (module.step === 'WAIT_FOR_MODE') {
        const choice = message.trim();
        const topic = module.topic || message;

        if (choice === '1' || choice.toLowerCase().includes('explain') || choice.toLowerCase().includes('step')) {
            module.step = 'DONE';
            module.active = false;
            // Call doubt solver with the REMEMBERED topic, not just "1"
            return await tppDoubtSolverAgent(topic, state, appName);
        }

        if (choice === '2' || choice.toLowerCase().includes('quiz') || choice.toLowerCase().includes('practice')) {
            module.step = 'DONE';
            module.active = false;
            // Route to practice loop with the remembered topic
            state.current_state = 'Practice Loop';
            return await tppWeaknessDrillerAgent(`Quiz me on ${topic}`, state, appName);
        }

        // If they typed something else, treat it as a new topic/question
        module.step = 'DONE';
        module.active = false;
        return await tppDoubtSolverAgent(choice, state, appName);
    }

    // ── Fallback: already done, just answer directly ──
    module.active = false;
    return await tppDoubtSolverAgent(message, state, appName);
};

// ─────────────────────────────────────────────────────────────
//  INTENT DETECTOR
// ─────────────────────────────────────────────────────────────
const detectIntent = (msg) => {
    const m = (msg || "").toLowerCase();

    // ── PRIORITY 1: Study plan / schedule (must be checked FIRST) ──
    // Catches: "study plan", "make me a 2-week plan", "weekly schedule", "roadmap"
    const isPlan = (
        m.includes('study plan') ||
        m.includes('week plan') ||
        m.includes('day plan') ||
        m.includes('daily plan') ||
        m.includes('make me a plan') ||
        m.includes('create a plan') ||
        m.includes('schedule') ||
        m.includes('roadmap') ||
        (m.includes('plan') && (m.includes('week') || m.includes('day') || m.includes('month') || m.includes('sat')))
    );
    if (isPlan) return 'Plan Session';

    // ── PRIORITY 2: Practice / quiz ──
    if (m.includes('quiz') || m.includes('practice') || m.includes('question') || m.includes('drill') || m.includes('test me') || m.includes('give me')) {
        return 'Practice Loop';
    }

    // ── PRIORITY 3: Concept explanation / teaching ──
    if (m.includes('teach') || m.includes('explain') || m.includes('what is') || m.includes('how to') || m.includes('learn') || m.includes('understand')) {
        if (!m.includes('quiz') && !m.includes('practice') && !m.includes('question') && !m.includes('drill')) {
            return 'StructuredTeaching';
        }
    }

    // ── PRIORITY 4: Doubt / help ──
    if (m.includes('stuck') || m.includes('hint') || m.includes('help') || m.includes('confused') || m.includes('doubt')) return 'Doubt Solving';

    // ── PRIORITY 5: Reports ──
    if (m.includes('report') || m.includes('progress') || m.includes('parent')) return 'Parent Report';

    return null;
};

// ─────────────────────────────────────────────────────────────
//  MAIN ORCHESTRATOR
// ─────────────────────────────────────────────────────────────
export const handleTutorRequest = async (userId, message, context, difficulty) => {
    try {
        const [siteSettings, state] = await Promise.all([getAppSettings(), getStudentState(userId)]);
        const appName = siteSettings.app_name || 'AIPrep365';

        // Initialize state
        if (!state.current_state) state.current_state = "Start Session";
        if (!state.preferences) state.preferences = {};

        // Apply difficulty from request (UI button) or extract from message
        if (difficulty) {
            state.preferences.difficulty = difficulty;
        } else {
            // Extract difficulty from message text
            const msgL = (message || "").toLowerCase();
            if (msgL.includes('hard')) state.preferences.difficulty = 'Hard';
            else if (msgL.includes('easy')) state.preferences.difficulty = 'Easy';
            else if (msgL.includes('medium')) state.preferences.difficulty = 'Medium';
        }

        const msgLower = (message || "").toLowerCase().trim();
        state.session_log = state.session_log || [];
        state.session_log.push({ sender: 'user', text: message, timestamp: new Date() });

        // ── Routing ──
        let nextState = detectIntent(message);
        const exitKeywords = ['stop', 'exit', 'quit', 'reset', 'new session', 'start over'];

        const inTeacher = state.current_state === 'StructuredTeaching' && state.teaching_module?.active;
        const inQuiz = state.current_state === 'Practice Loop' && state.practice_module?.active;

        // ── Detect if the message is an actual quiz answer submission ──
        // Real answers look like: "1A", "1A, 2B, 3C", "A B C D", "1.A 2.B"
        const isAnswerSubmission = /^[\s,]*(\d*[\s.)]*[a-dA-D][\s,]*){1,5}$/.test(msgLower.trim());

        // ── Detect if this is a NEW topic/quiz request (should override sticky state) ──
        const isNewQuizRequest = nextState === 'Practice Loop';
        const isNewTeachRequest = nextState === 'StructuredTeaching' || nextState === 'Plan Session' || nextState === 'Doubt Solving';
        const isExitRequest = exitKeywords.some(k => msgLower.includes(k));

        if (isExitRequest) {
            // Hard reset all modules
            if (state.teaching_module) state.teaching_module.active = false;
            if (state.practice_module) state.practice_module.active = false;
            nextState = 'Start Session';

        } else if (inQuiz && isAnswerSubmission) {
            // User is submitting answers — keep grading the current quiz
            nextState = 'Practice Loop';

        } else if (isNewQuizRequest && !isAnswerSubmission) {
            // User requested a NEW quiz (either in progress or from another state)
            console.log(`🔄 [Tutor] Resetting active quiz. User requested new topic: "${message}"`);
            if (state.practice_module) {
                state.practice_module.active = false;
                state.practice_module.quiz_data = null;
            }
            nextState = 'Practice Loop';

        } else if (inQuiz && !isAnswerSubmission && !isNewQuizRequest) {
            // User is in a quiz but said something unrelated — treat as question/doubt
            // Don't force grading on non-answer text
            nextState = nextState || 'Doubt Solving';

        } else if (inTeacher && !isNewQuizRequest && !isNewTeachRequest && !isExitRequest) {
            // Stay in teaching flow
            nextState = 'StructuredTeaching';
        }

        // Force Practice Loop when user submits pure quiz answers (e.g. "1A, 2B, 3C")
        if (!nextState && isAnswerSubmission && inQuiz) {
            nextState = 'Practice Loop';
        }

        if (!nextState) nextState = 'Doubt Solving';
        if (nextState !== state.current_state) state.current_state = nextState;

        // ── Execution ──
        let agentResponse;
        switch (state.current_state) {
            case "StructuredTeaching":
                agentResponse = await tppStructuredTeacherAgent(message, state, appName);
                break;
            case "Practice Loop":
                agentResponse = await tppWeaknessDrillerAgent(message, state, appName);
                break;
            case "Doubt Solving":
                agentResponse = await tppDoubtSolverAgent(message, state, appName);
                break;
            case "Plan Session":
                agentResponse = await tppDiagnosticPlannerAgent(message, state, appName);
                break;
            case "Review":
                agentResponse = await tppTestAnalystAgent(message, state, appName);
                break;
            case "Parent Report":
                agentResponse = await tppParentReporterAgent(message, state, appName);
                break;
            default:
                agentResponse = await tppSatTutorAgent(message, state, appName);
        }

        const reply = agentResponse?.reply || "I'm here to help. What topic would you like to practice?";
        state.session_log.push({ sender: 'ai', text: reply, timestamp: new Date() });
        await updateStudentState(userId, state);
        return { reply };

    } catch (err) {
        console.error("❌ Tutor Error:", err);
        return { reply: "I encountered an error. Please try again or type 'reset' to start a new session." };
    }
};
