import { generateAIResponse, extractJSON } from './ai.js';
import { getStudentState, updateStudentState } from './studentState.js';
import { getAppSettings } from './settingsHelper.js';

// ─────────────────────────────────────────────────────────────
//  OPTION SANITIZER
//  Converts any LaTeX in answer options to plain readable text.
//  Applied to every option before it is sent to the student.
// ─────────────────────────────────────────────────────────────



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

    // ── Determine difficulty ──
    let difficulty = state.preferences?.difficulty || 'Medium';
    const msgLower = message.toLowerCase();
    if (msgLower.includes('hard')) difficulty = 'Hard';
    else if (msgLower.includes('easy')) difficulty = 'Easy';
    else if (msgLower.includes('medium')) difficulty = 'Medium';

    // ── PHASE 1: Start a new quiz ──
    if (!module.active) {
        // ── STEP A: Extract topic + count DIRECTLY from message (NO AI - prevents topic simplification) ──
        
        // Extract count first (e.g., "5 questions", "10 question", "quiz with 10", "give me 5")
        // Robust regex to find numbers associated with questions/quizzes
        const countMatch = message.match(/(?:(?:give\s+me|show|want|take)\s+)?(\d+)\s*(?:question|questions|qs|q\b|practice|drill|test)?/i);
        const count = countMatch ? Math.min(Math.max(parseInt(countMatch[1]), 1), 50) : 10;

        // Extract topic directly using common phrasing patterns
        let rawTopic = null;
        const topicPatterns = [
            /(?:quiz\s+on|questions?\s+on|questions?\s+about|practice\s+on|test\s+on|drill\s+on|topic\s*[:=])\s+(.+)/i,
            /(?:give\s+me|create|generate|show|make)\s+(?:\d+\s+)?(?:question|questions)?\s*(?:on|about|for)\s+(.+)/i,
            /(?:on|about|for)\s+(.+)\s+(?:quiz|questions?|practice|drill)/i,
        ];

        for (const pattern of topicPatterns) {
            const m = message.match(pattern);
            if (m && m[1]) {
                // Clean trailing noise words
                rawTopic = m[1].replace(/\s*(quiz|questions?|practice|please|now|difficulty|hard|medium|easy)\s*$/i, '').trim();
                break;
            }
        }

        // If no pattern matched, use the entire message as the topic
        if (!rawTopic) rawTopic = message;

        console.log(`🎯 [Tutor] Parsed Topic: "${rawTopic}" | Count: ${count} | Difficulty: ${difficulty}`);

        // ── Step B: Fetch questions EXCLUSIVELY from Knowledge Base (DB) ──
        const excludeIds = state.seen_question_ids || [];
        console.log(`📚 [Tutor] Fetching ${count} KB questions | Topic: "${rawTopic}" | Difficulty: ${difficulty} | Excluded: ${excludeIds.length}`);
        
        // Import the new prep365KB search function for strict KB-only questions
        const { searchExactKBQuestions } = await import('./prep365KB.js');
        const kbQuestions = await searchExactKBQuestions(rawTopic, difficulty, count, excludeIds);

        // ── Handle exhaustion ──
        if (kbQuestions.length === 0) {
            // Check if there are ANY questions for this topic at all (ignoring exclusion)
            const globalCheck = await searchExactKBQuestions(rawTopic, difficulty, 1, []);
            
            if (globalCheck.length > 0) {
                // Topic exists but questions are exhausted for THIS user
                console.log(`🏁 [Tutor] All questions completed for User: ${state.user_id} | Topic: "${rawTopic}"`);
                return {
                    reply: `🎉 **All questions completed!**\n\nYou've already tackled all the available questions for **"${rawTopic}"** at the **${difficulty}** level.\n\nExcellent work! Try a different topic or challenge yourself with a higher difficulty level to continue your progress.`
                };
            } else {
                // Truly no questions found at all for this topic in KB
                return {
                    reply: `❌ No questions found in Knowledge Base for topic: **"${rawTopic}"** at **${difficulty}** difficulty.\n\n**Please check:**\n• Topic spelling matches KB file names exactly\n• Try different difficulty level\n• Available topics in your Knowledge Base:\n${getAvailableTopicsAsString ? '\n' + getAvailableTopicsAsString() : ''}`
                };
            }
        }

        // ── Track these questions so they aren't repeated ──
        state.seen_question_ids = [...excludeIds, ...kbQuestions.map(q => q.id)];

        // ── Step C: Format questions for current state (Internal storage includes explanation) ──
        // Note: Students never see this state directly.
        const quizData = {
            topic: kbQuestions[0]?.topic || rawTopic,
            difficulty,
            questions: kbQuestions.map(q => ({
                id: q.id,
                text: q.text,
                options: q.options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation, // Stored for Phase 2
                concept: q.topic
            }))
        };
        module.active = true;
        module.quiz_data = quizData;

        // ── Step D: Build the display message (No explanations shown) ──
        const questionBlocks = quizData.questions.map((q, i) => {
            const optionLines = q.options
                .map((o, idx) => `**${String.fromCharCode(65 + idx)})** ${o}`)
                .join('   ');
            return `### Question ${i + 1}\n${q.text}\n\n${optionLines}`;
        }).join('\n\n---\n\n');

        return {
            reply:
                `## Digital SAT Quiz: ${quizData.topic}\n` +
                `*Difficulty: ${difficulty}* • *Total: ${quizData.questions.length} Questions*\n\n` +
                `${questionBlocks}\n\n` +
                `**Please reply with your answers (e.g., 1A, 2B, 3C...)**`
        };
    }

    // ── PHASE 2: Grade submitted answers ──
    if (module.active) {
        const quizData = module.quiz_data;
        const answerKey = quizData.questions.map((q, i) => `Q${i + 1}: ${q.correctAnswer}`).join(', ');

        const gradingPrompt = `You are an expert SAT grader.
        
Quiz Answer Key: ${answerKey}
Student's Answers: "${message}"
Number of Questions: ${quizData.questions.length}

TASK:
1. Parse the student's answers (they might use formats like "1A, 2B", "A, B, C", or "1. A, 2. B").
2. Compare each answer to the answer key provided above.
3. Determine if each response is correct.

OUTPUT JSON:
{
  "score": <number_correct>,
  "reviews": [
    {
      "q_num": 1,
      "isCorrect": true/false,
      "student_answer": "A"
    }
  ]
}
Return ONLY valid JSON.`;

        const gradingRes = await generateAIResponse([{ role: "user", content: gradingPrompt }], true, 0.3, true);
        const results = extractJSON(gradingRes);

        if (!results || !results.reviews) {
            return { reply: "I couldn't read your answers. Please type them like: **1A, 2B, 3C**" };
        }

        const score = results.reviews.filter(r => r.isCorrect).length;
        const total = quizData.questions.length;
        const pct = Math.round((score / total) * 100);

        let report = `## Quiz Results: ${quizData.topic}\n`;
        report += `**Final Score: ${score} / ${total} (${pct}%)**\n\n`;

        results.reviews.forEach((res, i) => {
            const q = quizData.questions[i];
            const isCorrect = res.isCorrect;
            const status = isCorrect ? "✅ **Correct**" : "❌ **Incorrect**";
            const studentChoice = res.student_answer || "?";

            report += `### Question ${i + 1} Review\n`;
            report += `${status}${!isCorrect ? ` (You chose ${studentChoice}, Correct was ${q.correctAnswer})` : ""}\n\n`;
            report += `**Solution & Explanation:**\n${q.explanation}\n\n`;
        });

        report += `--- \nExcellent practice! Want to try another topic or set the difficulty to **Hard**? Just ask!`;

        module.active = false; // Reset state
        module.quiz_data = null;
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
