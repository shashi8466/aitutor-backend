import { generateAIResponse, extractJSON } from './ai.js';
import { getStudentState, updateStudentState } from './studentState.js';
import { getAppSettings } from './settingsHelper.js';

// --- AGENT DEFINITIONS ---
const LATEX_RULES = `
MATH FORMATTING (CRITICAL):
- Use \\\\( ... \\\\) for ALL math (variables, numbers with units, formulas).
- Use \\\\frac{num}{den} for fractions. NEVER leave an argument empty.
- NO SPACES in LaTeX commands (e.g., \\\\frac{a}{b}, NOT \\\\frac {a} {b}).
`;

// 1. SAFETY / INTEGRITY GUARD AGENT
const safetyGuard = async (message) => {
    const prompt = `
    Analyze the following student message for safety and academic integrity.
    Message: "${message}"
    
    Rules:
    1. Block requests to "just give the answer" without an attempt.
    2. detailed solution is OK if they tried or asked for explanation.
    3. Block inappropriate content.
    
    Return JSON: {"safe": true/false, "reason": "..."}
  `;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 1.5 QUICK RESPONSE AGENT - Fast responses for simple questions
const quickResponseAgent = async (message, appName) => {
    const prompt = `You are a helpful SAT tutor from ${appName}. Be concise and helpful.
${LATEX_RULES}

Student asks: "${message}"

Give a brief, helpful response. Use markdown formatting. Keep it under 100 words.
Return JSON: {"reply": "your_response_here"}`;

    // Use lower temperature AND fastMode for much faster responses
    const response = await generateAIResponse([{ role: "user", content: prompt }], true, 0.5, true);
    return extractJSON(response);
};

// 2. ORCHESTRATOR AGENT (ROUTER)
const orchestrator = async (message, state) => {
    const prompt = `
    You are the Orchestrator for an AI Tutor.
    Current Student State: ${JSON.stringify(state)}
    Last User Message: "${message}"
    
    Decide the next state based on the flow:
    START -> [State 0] Start Session -> [State 1] Intake -> [State 2] Diagnose -> [State 3] Plan -> [State 4] Teach -> [State 5] Practice -> [State 6] Review -> [State 7] Recap -> END
    
    If the user message indicates a specific intent (e.g., "I want to practice math"), route accordingly.
    
    Available Agents/States:
    - "Teach" (TPP_SAT_TUTOR): General teaching, concept explanation.
    - "Plan Session" (TPP_DIAGNOSTIC_PLANNER): Study planning.
    - "Practice Loop" (TPP_WEAKNESS_DRILLER): Drills and weakness targeting.
    - "Doubt Solving" (TPP_DOUBT_SOLVER): Specific homework help or doubts.
    - "Parent Report" (TPP_PARENT_REPORTER): Summary for parents.
    - "Review" (TPP_TEST_ANALYST): Post-test analysis.
    
    Return JSON: {"next_state": "State Name", "rationale": "..."}
    Valid States: "Start Session", "Intake", "Diagnose", "Plan Session", "Teach", "Practice Loop", "Review", "Parent Report", "Doubt Solving"
  `;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response) || { next_state: "Teach" };
};

// 3. TPP_SAT_TUTOR: Personal AI SAT Tutor Agent
const tppSatTutorAgent = async (message, state, appName) => {
    const difficulty = state.preferences?.difficulty || 'Medium';
    const prompt = `
    Agent Name: TPP_SAT_TUTOR
    
    You are an elite SAT tutor from ${appName}.
    You specialize in Digital SAT Math, Reading, and Writing.

    STREAMLINED FORMAT (CRITICAL):
    - DO NOT use repetitive headers like "### 1. Identified Skill" or "### 2. Challenge Question".
    - Write in a natural, conversational flow using clean paragraphs.
    - Integrated explanation and questions into the text.

    CORE REQUIREMENTS:
    - **LEVEL-LOCKED CONTENT (MANDATORY)**: You MUST only teach concepts and provide examples that belong to the **${difficulty}** tier.
        * **EASY**: Foundations, basic grammar, linear equations.
        * **MEDIUM**: Standard SAT passages, quadratic systems, logical transitions.
        * **HARD**: Advanced rhetoric, complex trigonometry, abstract multi-step logic.
    - DIGITAL SAT STANDARDS: All content must align with official Digital SAT domains.
    - STERN RULE: NEVER provide final answers in the first response.

    Rules:
    - Use step-by-step reasoning.
    - Ask a specific guiding question next.
    ${LATEX_RULES}
    
    Input Context:
    User Message: "${message}"
    
    Return JSON: {"reply": "conversational_markdown_response"}
    
    STRICT NEGATIVE CONSTRAINT:
    - NEVER deviate from the **${difficulty}** tier. If Hard is selected, do NOT explain basic concepts unless they are foundational to a complex step.
    - NEVER use robotic headers or categories.
  `;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 4. TPP_DIAGNOSTIC_PLANNER: Diagnostic & Study Plan Agent
const tppDiagnosticPlannerAgent = async (message, state, appName) => {
    const prompt = `
    Agent Name: TPP_DIAGNOSTIC_PLANNER
    
    You are an SAT academic planner at ${appName}.
    STREAMLINED FORMAT: Use clean list items and headers ONLY for the main sections. Keep text descriptive and natural.

    Your task:
    - Analyze results across English and Math.
    - Create a realistic 12-week SAT mastery plan.
    
    Input Context:
    Diagnostic Score Breakdown: ${JSON.stringify(state.baseline || {})}
    User Message: "${message}"

    OUTPUT STYLE:
    Briefly discuss the student's current standing, then provide the roadmap in a clean, readable format without excessive numbering or robotic categories.
    
    Return JSON: {"reply": "roadmap_markdown_response"}
  `;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 5. TPP_WEAKNESS_DRILLER: Weakness Detection & Drill Generator
const tppWeaknessDrillerAgent = async (message, state, appName) => {
    const difficulty = state.preferences?.difficulty || 'Medium';
    const prompt = `
    Agent Name: TPP_WEAKNESS_DRILLER
    
    You are an SAT skills analyst at ${appName}.
    
    STREAMLINED FORMAT (CRITICAL):
    - NEVER use robotic headers like "### Identified Skill" or "### Challenge Question".
    - IF the student asks for multiple questions (e.g., "5 questions" or "10 drills"), provide them ALL in a clean numbered list (1., 2., 3...).
    - IF providing only 1 question, write it in a natural paragraph without numbering.
    - Start with a natural conversational sentence acknowledging the topic (e.g., "Let's work on some algebra! Here are 10 questions to test your skills:").
    - Do not state difficulty labels (like "Easy level") unless asked.

    STRICT RULES:
    - MULTIPLE CHOICE FORMAT (CRITICAL): Every question MUST be a Multiple Choice Question (MCQ) with 4 options (A, B, C, D).
    - **LEVEL-LOCKED CONTENT (MANDATORY)**: You MUST only generate questions and topics that belong to the **${difficulty}** tier.
        * **IF EASY**: Focus on basic foundations, 1-2 step word problems, and fundamental grammar. (Target Score: 200-400).
        * **IF MEDIUM**: Focus on standard SAT complexity, interpreting charts/graphs, and logical transitions. (Target Score: 400-600).
        * **IF HARD**: Focus on advanced trigonometry, complex rhetorical synthesis, and abstract multi-variable systems. (Target Score: 600-800).
    - AUTHENTIC DIGITAL SAT FORMAT: Mimic official Digital SAT style exactly.
    - NO ANSWERS: DO NOT reveal the correct option in your response.
    - QUANTITY: Fulfill the exact count requested (e.g., 10).
    ${LATEX_RULES}
    
    Input Context:
    User Message: "${message}"

    Return JSON: {"reply": "conversational_or_list_markdown"}

    STRICT NEGATIVE CONSTRAINT:
    - NEVER mix difficulty levels. If ${difficulty} is selected, do NOT provide questions from other tiers.
    - NEVER provide 1-step equations for Hard difficulty.
    - NEVER provide complex abstract logic for Easy difficulty.
    - DO NOT use robotic categories or headers.
  `;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 6. TPP_DOUBT_SOLVER: 24/7 Doubt-Solving Agent
const tppDoubtSolverAgent = async (message, state, appName) => {
    const difficulty = state.preferences?.difficulty || 'Medium';
    const prompt = `
    Agent Name: TPP_DOUBT_SOLVER
    
    You are a supportive SAT tutor at ${appName}.

    STREAMLINED FORMAT (CRITICAL):
    - NO robotic headers like "**1. Problem Breakdown**".
    - Use natural phrasing and conversational transitions.
    - Break down the logic step-by-step in paragraphs.

    Rules:
    - NEVER give the final answer immediately.
    - Withhold the answer until requested or attempt made.
    ${LATEX_RULES}
    
    Input Context:
    Student Question: "${message}"
    
    RESPONSE STYLE:
    "Looking at your question about [Topic], the key is to understand [Concept]..." Followed by a hint or a starting step.
    
    Return JSON: {"reply": "natural_flow_markdown_response"}
  `;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};


// 7. TPP_PARENT_REPORTER: Parent Communication Agent
const tppParentReporterAgent = async (message, state, appName) => {
    const prompt = `
    Agent Name: TPP_PARENT_REPORTER
    
    You are a professional academic advisor communicating with parents on behalf of ${appName}.

    Input Context:
    Student Name: ${state.user_name || 'Student'}
    Performance Data: ${JSON.stringify(state.mastery || {})}
    Current Score: ${state.baseline?.total || 1200}
    Target Score: ${state.goal || '1400+'}
    Drills Completed: ${state.session_log?.filter(l => l.text?.includes('drill'))?.length || 3}
    
    Task: Write a progress email exactly matching this format:

    OUTPUT FORMAT (Markdown):
    **Dear Parent,**

    **We’re happy to share your child’s weekly SAT preparation progress.**

    ### **📊 Weekly Progress Summary**

    **Math Score:** [Insert Score, e.g. 640]
    *(↑ [X]% improvement in accuracy, with notable gains in [Topic])*

    **English (Reading & Writing) Score:** [Insert Score, e.g. 600]
    *(Steady improvement in [Topic] and [Topic])*

    **Practice Completed:**
    [Number] focused and challenging practice drills

    **Current Total SAT Score:** [Total]
    **Target Score:** [Target]

    ### **📈 Progress Outlook**

    Your child is making consistent and meaningful progress and is currently on track toward the [Target] goal. We will continue concentrating on high-impact topics and targeted practice to maximize score improvement in the coming weeks.

    **Great momentum—keep up the excellent work!**

    **Warm regards,**
    **${appName} Learning Team**
    
    Return JSON: {"reply": "markdown_response_here"}
  `;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 8. TPP_TEST_ANALYST: Practice Test Review Agent
const tppTestAnalystAgent = async (message, state, appName) => {
    const prompt = `
    Agent Name: TPP_TEST_ANALYST
    
    You are an SAT performance analyst at ${appName}.

    Your role:
    - Review full practice tests
    - Identify patterns in mistakes
    - Recommend targeted improvements

    Classification:
    - Concept error
    - Timing issue
    - Careless mistake
    - Strategy gap
    
    Input Context:
    User Message: "${message}"
    Errors: ${JSON.stringify(state.error_patterns || {})}
    
    OUTPUT FORMAT (Markdown):
    1. Score Summary
    2. Error Pattern Breakdown
    3. Top 3 Fixable Issues
    4. Recommended Practice Plan
    5. Estimated Score Gain
    
    Return JSON: {"reply": "markdown_response_here"}
  `;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 9. TPP_TUTOR_COPILOT: Tutor Assistant Agent
const tppTutorCopilotAgent = async (message, state, appName) => {
    const prompt = `
    Agent Name: TPP_TUTOR_COPILOT
    
    You assist human tutors at ${appName}.

    Goals:
    - Save tutor time
    - Improve lesson quality
    - Highlight what matters most

    Rules:
    - Be concise
    - Be actionable
    
    Input Context:
    Student Snapshot: ${JSON.stringify(state.baseline || {})}
    Current Weaknesses: ${JSON.stringify(state.mastery || {})}
    
    OUTPUT FORMAT (Markdown):
    1. Student Snapshot
    2. Current Weaknesses
    3. Suggested Lesson Plan
    4. Homework Recommendations
    5. Talking Points for Tutor
    
    Return JSON: {"reply": "markdown_response_here"}
  `;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// --- REFINED ORCHESTRATOR HANDLER ---

// Helper to sanitize intent
const detectIntent = (msg) => {
    const m = msg.toLowerCase();

    // High Priority Keywords
    if (m.includes('intake') || (m.includes('start') && m.includes('coach')) || m.includes('reset goal')) return 'Intake';
    if ((m.includes('assess') && m.includes('level')) || m.includes('diagnostic')) return 'Diagnose';
    if (m.includes('plan') || m.includes('schedule') || m.includes('roadmap')) return 'Plan Session';
    if (m.includes('practice') || m.includes('drill') || m.includes('quiz')) return 'Practice Loop';
    if ((m.includes('report') && m.includes('parent')) || m.includes('summary')) return 'Parent Report'; // Mapped name
    if ((m.includes('review') && m.includes('test')) || m.includes('analyze mistake')) return 'Review';
    if (m.includes('stuck') || m.includes('hint') || m.includes('solve this') || m.includes('help me')) return 'Doubt Solving';

    // Fallback to Orchestrator prompt if no keywords match
    return null;
};

export const handleTutorRequest = async (userId, message, context, difficulty) => {
    try {
        console.log(`🧠 [Tutor Flow] Processing request for user ${userId} with difficulty ${difficulty}`);
        const startTime = Date.now();
        console.log(`🤖 [Tutor Agent] Step 1: Loading state for ${userId}`);

        // 0. Load Site Settings & State in parallel for speed
        const [siteSettings, state] = await Promise.all([
            getAppSettings(),
            getStudentState(userId)
        ]);
        const appName = siteSettings.app_name || 'Pundits AI';
        if (!state.current_state) state.current_state = "Start Session";

        // Update difficulty if provided
        if (difficulty) {
            state.preferences = state.preferences || {};
            state.preferences.difficulty = difficulty;
        }

        // 1. FAST SAFETY CHECK - Skip LLM for short/simple messages
        const msgLower = message.toLowerCase().trim();
        const isSuspicious = msgLower.includes('give me the answer') ||
            msgLower.includes('just tell me') ||
            msgLower.includes('cheat') ||
            message.length > 500; // Long messages need check

        if (isSuspicious) {
            const safety = await safetyGuard(message);
            if (safety && !safety.safe) {
                return { reply: "I cannot fulfill that request. " + (safety.reason || "Please try a different approach.") };
            }
        }

        // 2. Update Session Log
        state.session_log = state.session_log || [];
        state.session_log.push({ sender: 'user', text: message, timestamp: new Date() });

        // 3. FAST ROUTING - Use keyword detection first (no LLM call)
        let nextState = detectIntent(message);

        // Only use LLM orchestrator if no keyword match AND message is ambiguous
        if (!nextState && message.length > 20 && !msgLower.includes('?')) {
            // Skip orchestrator for simple questions - default to Teach/DoubtSolving
            nextState = msgLower.includes('how') || msgLower.includes('what') || msgLower.includes('why') || msgLower.includes('explain')
                ? 'Doubt Solving'
                : 'Teach';
            console.log(`👉 [Orchestrator] Fast-path routing to: ${nextState}`);
        } else if (!nextState) {
            // Default for short questions
            nextState = 'Doubt Solving';
            console.log(`👉 [Orchestrator] Default routing to: ${nextState}`);
        } else {
            console.log(`👉 [Orchestrator] Keyword forced state: ${nextState}`);
        }

        // Normalize state names if LLM messes up
        if (nextState === 'Recap') nextState = 'Parent Report';

        if (nextState && nextState !== state.current_state) {
            state.current_state = nextState;
        }

        // 4. FAST PATH - Use quick response for simple short questions (under 80 chars)
        const isSimpleQuestion = message.length < 80 &&
            (msgLower.includes('?') || msgLower.startsWith('what') || msgLower.startsWith('how') ||
                msgLower.startsWith('why') || msgLower.startsWith('explain') || msgLower.startsWith('help'));

        if (isSimpleQuestion && (nextState === 'Doubt Solving' || nextState === 'Teach')) {
            console.log(`⚡ [Fast Path] Using quick response for simple question`);
            const quickResp = await quickResponseAgent(message, appName);
            if (quickResp?.reply) {
                state.session_log.push({ sender: 'ai', text: quickResp.reply, timestamp: new Date() });
                await updateStudentState(userId, state);
                console.log(`✅ [Tutor Flow] Fast response in ${Date.now() - startTime}ms`);
                return { reply: quickResp.reply };
            }
        }

        // 5. Execute Agent based on State (full response for complex queries)
        let agentResponse;
        const sysOverride = (txt) => `SYSTEM_INSTRUCTION: ${txt}`;

        switch (state.current_state) {
            case "Intake":
                agentResponse = await tppSatTutorAgent(sysOverride("The user wants to start intake. Ask for Goal, Test Date, and Weaknesses explicitly."), state, appName);
                break;

            case "Diagnose":
                agentResponse = await tppDiagnosticPlannerAgent(sysOverride("Perform a diagnostic assessment. Ask 1 calibrated question or requests test data."), state, appName);
                break;

            case "Plan Session":
                agentResponse = await tppDiagnosticPlannerAgent(message, state, appName);
                break;

            case "Teach":
                agentResponse = await tppSatTutorAgent(message, state, appName);
                break;

            case "Practice Loop":
                agentResponse = await tppWeaknessDrillerAgent(message, state, appName);
                break;

            case "Review":
                agentResponse = await tppTestAnalystAgent(message, state, appName);
                break;

            case "Recap":
            case "Parent Report":
                agentResponse = await tppParentReporterAgent(message, state, appName);
                break;

            case "Doubt Solving":
                agentResponse = await tppDoubtSolverAgent(message, state, appName);
                break;

            case "Start Session":
            default:
                if (message.toLowerCase().includes("plan")) {
                    agentResponse = await tppDiagnosticPlannerAgent(message, state, appName);
                } else if (message.toLowerCase().includes("report") || message.toLowerCase().includes("parent")) {
                    agentResponse = await tppParentReporterAgent(message, state, appName);
                } else {
                    agentResponse = await tppSatTutorAgent(message, state, appName);
                }
                break;
        }

        // 6. Update State
        const reply = agentResponse?.reply || "I'm thinking...";
        state.session_log.push({ sender: 'ai', text: reply, timestamp: new Date() });

        // Persist state
        await updateStudentState(userId, state);

        return { reply };
    } catch (err) {
        console.error("❌ [Tutor Agent] Critical Error:", err);
        throw err; // Re-throw to be caught by route handler
    }
};
