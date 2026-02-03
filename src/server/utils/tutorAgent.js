import { generateAIResponse, extractJSON } from './ai.js';
import { getStudentState, updateStudentState } from './studentState.js';
import { getAppSettings } from './settingsHelper.js';
import { searchQuestions } from './satQuestionBank.js';

// --- AGENT DEFINITIONS ---
const LATEX_RULES = `
MATH FORMATTING (CRITICAL):
- Use \\( ... \\) for ALL math (variables, numbers with units, formulas).
- Use \\frac{num}{den} for fractions. NEVER leave an argument empty.
- NO SPACES in LaTeX commands (e.g., \\frac{a}{b}, NOT \\frac {a} {b}).
`;

const SAT_QUESTION_RULES = `
DIGITAL SAT GENERATION RULES (MANDATORY):
- Follow College Board (CB) specs for Digital SAT.
- EVERY question must be Multiple Choice (A-D).
- Use SAT Phrasing (e.g., "Which of the following is equivalent to...", "The system of equations above...", "In the figure shown...").
- Include distractors (common student errors) based on typical SAT patterns.
- Math: Focus on conceptual reasoning, abstraction (using constants like k, p), and multi-step logic.
- Reading/Writing: Focus on logical transitions, rhetorical synthesis, and evidence-supported claims.

STRICT NEGATIVE CONSTRAINTS (DO NOT DO THIS):
- NO direct memorization questions (e.g., "What is sin 60?", "Solve 2x=4").
- NO simple definitions.
- NO 1-step arithmetic.
- Questions MUST involve: Variable isolation, substitution, completing the square, or abstract constant reasoning.
`;

const SAT_EXAMPLES = `
Examples of TRUE SAT STYLE (Use these as templates):

Type: Advanced Algebra
"The equation x^2 + y^2 - 6x + 8y = 56 represents a circle in the xy-plane. What is the length of the radius of the circle?"
(Requires completing the square)

Type: Functions & Constants
"In the given equation kx - 3y = 4, k is a constant. If the graph of the equation in the xy-plane passes through the point (2, 5), what is the value of k?"
(Requires substitution and isolation)

Type: Trigonometry
"In triangle RST, angle S is a right angle. If cos R = 5/13, what is the value of sin T?"
(Requires co-function identity cos(x) = sin(90-x), not finding the angle)

Type: Linear Systems
"For which value of k will the system of equations kx - 2y = 5 and 4x - y = 9 have no solution?"
(Requires matching slopes)

Type: Geometry (Properties)
"In the figure above, point O is the center of the circle. The measure of arc AB is 40 degrees. What is the measure, in degrees, of angle AOB?"
(Requires understanding central angles vs inscribed angles)

Type: Problem Solving & Data Analysis
"The scatterplot shows the relationship between studying time (x hours) and test scores (y) for 20 students. The line of best fit is given by y = 3.5x + 60. What is the predicted score for a student who studies 4 hours?"
(Requires interpreting linear models in context)
`;

// 1. SAFETY / INTEGRITY GUARD AGENT
const safetyGuard = async (message) => {
    const prompt = `Analyze if this student request is safe and maintains academic integrity: "${message}". Block "just give answer" requests without attempt. JSON: {"safe": boolean, "reason": "string"}`;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 1.5 QUICK RESPONSE AGENT
const quickResponseAgent = async (message, appName) => {
    const prompt = `Helpful SAT tutor at ${appName}. Concise response (<100 words). ${LATEX_RULES}\nUser: "${message}"\nJSON: {"reply": "..."}`;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true, 0.5, true);
    return extractJSON(response);
};

// 2. TPP_SAT_TUTOR (General Teach)
const tppSatTutorAgent = async (message, state, appName) => {
    const difficulty = state.preferences?.difficulty || 'Medium';
    const prompt = `Agent: TPP_SAT_TUTOR. Digital SAT Elite Tutor at ${appName}. Level: ${difficulty}. ${LATEX_RULES}\nUser: "${message}"\nJSON: {"reply": "conversational_markdown"}`;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 3. TPP_DIAGNOSTIC_PLANNER
const tppDiagnosticPlannerAgent = async (message, state, appName) => {
    const prompt = `Agent: TPP_DIAGNOSTIC_PLANNER. Create 12-week SAT roadmap for: ${JSON.stringify(state.baseline || {})}.\nUser: "${message}"\nJSON: {"reply": "markdown_roadmap"}`;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 4. SAT_PRACTICE_MODE (Stateful Quiz)
const tppWeaknessDrillerAgent = async (message, state, appName) => {
    if (!state.practice_module) {
        state.practice_module = { active: false, quiz_data: null };
    }
    const module = state.practice_module;

    // Check if user explicitly requested a difficulty in THIS message
    let difficulty = state.preferences?.difficulty || 'Medium';
    const msgLower = message.toLowerCase();
    if (msgLower.includes('hard')) difficulty = 'Hard';
    else if (msgLower.includes('easy')) difficulty = 'Easy';
    else if (msgLower.includes('medium')) difficulty = 'Medium';

    if (!module.active) {

        // Updated Prompt: Extract relevant search keywords.
        const paramPrompt = `Identify the specific SAT TOPIC (Math or English) from this request: "${message}". 
        Examples: "Trigonometry", "Words in Context", "Grammar", "Linear Equations".
        
        OUTPUT JSON: {"topic": "Keyword", "count": 5}
        If vague but Math-related (e.g. "numbers", "calc"), use "Math".
        If vague but English-related (e.g. "reading", "writing"), use "English".`;
        const paramRes = await generateAIResponse([{ role: "user", content: paramPrompt }], true);
        const params = extractJSON(paramRes) || { topic: "Math", count: 5 };
        const count = Math.min(Math.max(params.count, 1), 5); // Limit to 5 for quality

        // STRICT KB LOOKUP - NO GENERATION
        let kbQuestions = searchQuestions(params.topic, count, difficulty);

        // Fallback: If no questions found...
        if (kbQuestions.length === 0) {
            // 1. Try "Math" broad search if topic looks like math or generic
            kbQuestions = searchQuestions("Math", count, difficulty);
            // 2. If still empty, Try "English" broad search (maybe user asked for reading)
            if (kbQuestions.length === 0) kbQuestions = searchQuestions("English", count, difficulty);

            params.topic = "Practice Mix"; // Update topic label
        }

        if (kbQuestions.length === 0) {
            // HYBRID FALLBACK: If KB fails, generate using high-quality constraints (Unlimited Mode)
            const genPrompt = `
             Agent: SAT_PRACTICE_ENGINE
             TASK: Generate ${count} HIGH-STAKES Digital SAT questions for specific topic: "${params.topic}".
             Difficulty: ${difficulty}
             
             ${SAT_QUESTION_RULES}
             
             OUTPUT JSON:
             {
               "topic": "${params.topic}",
               "questions": [
                 {
                   "id": "gen_1",
                   "text": "Question text...",
                   "options": ["A", "B", "C", "D"],
                   "correctAnswer": "A",
                   "explanation": "Detailed step-by-step."
                 }
               ]
             }
             `;
            const genRes = await generateAIResponse([{ role: "user", content: genPrompt }], true);
            const genData = extractJSON(genRes);

            if (genData?.questions) {
                kbQuestions = genData.questions;
                params.topic = `${params.topic} (AI Generated)`;
            } else {
                return { reply: `I couldn't find or generate questions for **${params.topic}**. Let's try a standard topic like Algebra or Grammar.` };
            }
        }

        const quizData = {
            topic: params.topic,
            questions: kbQuestions
        };

        module.active = true;
        module.quiz_data = quizData;

        const formatted = quizData.questions.map((q, i) =>
            `**Question ${i + 1}**\n${q.text}\n\n` +
            q.options.map((o, idx) => `- **${String.fromCharCode(65 + idx)})** ${o}`).join('\n')
        ).join('\n\n---\n\n');

        return { reply: `### 🎯 Digital SAT Practice: ${quizData.topic}\nLevel: **${difficulty}** (Verifed KB Content)\n\n${formatted}\n\n---\n**Reply with your answers (e.g. 1A, 2B...) to see your score.**` };
    }

    if (module.active) {
        const quizData = module.quiz_data;
        const gradingPrompt = `
        Agent: SAT_GRADER
        Quiz Key: ${quizData.questions.map(q => `${q.id}: ${q.correctAnswer}`).join(', ')}
        Student Answers: "${message}"
        
        TASK:
        1. Evaluate answers carefully.
        2. Show Score.
        3. Provide SAT-level feedback for each question.
        4. For incorrect answers, explicitly identify the "distractor trap" the student likely fell into.
        
        OUTPUT JSON:
        {
          "score": 0,
          "total": ${quizData.questions.length},
          "reviews": [{"id": 1, "isCorrect": boolean, "explanation": "Brief rationale"}]
        }
        `;
        const gradingRes = await generateAIResponse([{ role: "user", content: gradingPrompt }], true);
        const results = extractJSON(gradingRes);

        if (!results) return { reply: "I couldn't parse your answers. Please use the format '1A, 2B'." };

        let report = `### ✅ Quiz Evaluation Complete\n\n**Score: ${results.score} / ${results.total}**\n\n**Detailed Review:**\n\n`;
        results.reviews.forEach((r, i) => {
            const q = quizData.questions[i];
            report += `**${i + 1}️⃣** ${r.isCorrect ? 'Correct ✅' : `Incorect ❌ (Correct: **${q.correctAnswer}**)`}\n*Insight: ${r.explanation}*\n\n`;
        });
        report += `---\n**What's next?** 1. Retry 2. New Topic 3. Discussion`;

        module.active = false; // End quiz loop
        return { reply: report };
    }
};

// 5. DOUBT SOLVER
const tppDoubtSolverAgent = async (message, state, appName) => {
    const prompt = `Agent: TPP_DOUBT_SOLVER at ${appName}. Natural, conversational SAT help. ${LATEX_RULES}\nUser: "${message}"\nJSON: {"reply": "..."}`;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 6. PARENT REPORTER
const tppParentReporterAgent = async (message, state, appName) => {
    const prompt = `Agent: TPP_PARENT_REPORTER at ${appName}. Format progress report.\nState: ${JSON.stringify(state)}\nJSON: {"reply": "..."}`;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 7. TEST ANALYST
const tppTestAnalystAgent = async (message, state, appName) => {
    const prompt = `Agent: TPP_TEST_ANALYST. Analyze test errors: ${JSON.stringify(state.error_patterns || {})}.\nUser: "${message}"\nJSON: {"reply": "..."}`;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 8. STRUCTURED TEACHER
const tppStructuredTeacherAgent = async (message, state, appName) => {
    if (!state.teaching_module) state.teaching_module = { active: false, step: 'INIT' };
    const module = state.teaching_module;
    if (!module.active) {
        module.active = true; module.step = 'WAIT_FOR_MODE';
        return { reply: "Let's start learning! Would you like 1. Step-by-step or 2. Quiz?" };
    }
};

// --- ORCHESTRATOR HANDLER ---

const detectIntent = (msg) => {
    const m = (msg || "").toLowerCase();
    if (m.includes('teach') || m.includes('learn') || m.includes('study')) return 'StructuredTeaching';
    if (m.includes('quiz') || m.includes('practice') || m.includes('questions') || m.includes('drill')) return 'Practice Loop';
    if (m.includes('plan') || m.includes('schedule')) return 'Plan Session';
    if (m.includes('stuck') || m.includes('hint') || m.includes('help me')) return 'Doubt Solving';
    return null;
};

export const handleTutorRequest = async (userId, message, context, difficulty) => {
    try {
        const [siteSettings, state] = await Promise.all([getAppSettings(), getStudentState(userId)]);
        const appName = siteSettings.app_name || 'Personal AI Tutor';
        if (!state.current_state) state.current_state = "Start Session";
        if (difficulty) { state.preferences = state.preferences || {}; state.preferences.difficulty = difficulty; }

        const msgLower = (message || "").toLowerCase().trim();
        state.session_log = state.session_log || [];
        state.session_log.push({ sender: 'user', text: message, timestamp: new Date() });

        // ROUTING
        let nextState = detectIntent(message);

        // Sticky states override
        const exitKeywords = ['stop', 'exit', 'quit', 'reset'];
        const inTeacher = state.current_state === 'StructuredTeaching' && state.teaching_module?.active;
        const inQuiz = state.current_state === 'Practice Loop' && state.practice_module?.active;

        if ((inTeacher || inQuiz) && !exitKeywords.some(k => msgLower.includes(k))) {
            nextState = state.current_state;
        } else if (exitKeywords.some(k => msgLower.includes(k))) {
            if (state.teaching_module) state.teaching_module.active = false;
            if (state.practice_module) state.practice_module.active = false;
            nextState = 'Start Session';
        }

        // Regex for answers to force Practice Loop
        if (!nextState && (msgLower.includes('answer') || msgLower.match(/\d+[)\.]\s*[a-d]/i))) {
            if (state.current_state !== 'StructuredTeaching') nextState = 'Practice Loop';
        }

        if (!nextState) nextState = 'Doubt Solving';
        if (nextState && nextState !== state.current_state) state.current_state = nextState;

        // EXECUTION
        let agentResponse;
        switch (state.current_state) {
            case "StructuredTeaching": agentResponse = await tppStructuredTeacherAgent(message, state, appName); break;
            case "Practice Loop": agentResponse = await tppWeaknessDrillerAgent(message, state, appName); break;
            case "Doubt Solving": agentResponse = await tppDoubtSolverAgent(message, state, appName); break;
            case "Plan Session": agentResponse = await tppDiagnosticPlannerAgent(message, state, appName); break;
            case "Review": agentResponse = await tppTestAnalystAgent(message, state, appName); break;
            case "Parent Report": agentResponse = await tppParentReporterAgent(message, state, appName); break;
            default: agentResponse = await tppSatTutorAgent(message, state, appName); break;
        }

        const reply = agentResponse?.reply || "I'm here to help. What's on your mind?";
        state.session_log.push({ sender: 'ai', text: reply, timestamp: new Date() });
        await updateStudentState(userId, state);
        return { reply };
    } catch (err) {
        console.error("❌ Tutor Error:", err);
        return { reply: "I encountered an error. Let's try restarting our session." };
    }
};
