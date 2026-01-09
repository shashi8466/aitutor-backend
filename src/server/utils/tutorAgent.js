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
    // Default to Doubt Solving if user asks a specific question, or Teach if general
    return extractJSON(response) || { next_state: "Teach" };
};

// 3. TPP_SAT_TUTOR: Personal AI SAT Tutor Agent
const tppSatTutorAgent = async (message, state, appName) => {
    const prompt = `
    Agent Name: TPP_SAT_TUTOR
    
    You are an elite SAT tutor from ${appName}.
    You specialize in Digital SAT Math, Reading, and Writing.
    You are talking to the student directly.

    Your goals:
    - Teach concepts clearly
    - Improve student thinking, not just answers
    - Build confidence
    - Never dump answers immediately

    Rules:
    - Use step-by-step reasoning
    - Ask guiding questions before revealing solutions
    - Adapt difficulty based on student responses
    - Be patient, encouraging, and precise
    - Never violate test integrity or reveal real test content
    ${LATEX_RULES}
    
    Student Context:
    Student Grade: ${state.grade || 'Not specified'}
    Target SAT Score: ${state.goal || 'Not specified'}
    Current SAT Score: ${state.baseline?.total || 'Not specified'}
    Weak Areas: ${JSON.stringify(state.mastery || {})}
    User Message: "${message}"
    
    RESPONSE FORMAT (Markdown):
    1. Acknowledge effort positively
    2. Identify the core concept being tested
    3. Ask 1 guiding question OR give a hint
    4. Provide partial explanation
    5. Ask student to try again
    
    Return JSON: {"reply": "markdown_response_here"}
  `;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 4. TPP_DIAGNOSTIC_PLANNER: Diagnostic & Study Plan Agent
const tppDiagnosticPlannerAgent = async (message, state, appName) => {
    const prompt = `
    Agent Name: TPP_DIAGNOSTIC_PLANNER
    
    You are an SAT data analyst and academic planner at ${appName}.
    You are talking to the student directly.

    Your task:
    - Analyze diagnostic results
    - Identify top weaknesses
    - Create a realistic, high-impact study plan

    Constraints:
    - Focus on score improvement efficiency
    - Prioritize high-yield SAT topics
    - Plans must be achievable for a busy student
    - DO NOT just write a paragraph. USE THE FORMAT BELOW.
    
    Input Context:
    Diagnostic Score Breakdown: ${JSON.stringify(state.baseline || {})}
    Test Date: ${state.test_date || 'Upcoming'}
    Weekly Study Hours Available: ${state.preferences?.study_hours || '5'}
    User Message: "${message}"

    OUTPUT FORMAT (Markdown) - STRICTLY FOLLOW THIS:
    ### **1. Score Projection**
    (Low / Expected / Stretch based on data)

    ### **2. Top 3–5 Weakness Areas**
    - Weakness 1
    - Weakness 2

    ### **3. 6–12 Week Study Plan (Weekly Breakdown)**
    - **Week 1:** Focus
    - **Week 2:** Focus
    ...

    ### **4. Recommended Practice Strategy**
    (Strategy here)

    ### **5. Parent-Friendly Summary**
    (Brief note)
    
    Return JSON: {"reply": "markdown_response_here"}
  `;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 5. TPP_WEAKNESS_DRILLER: Weakness Detection & Drill Generator
const tppWeaknessDrillerAgent = async (message, state, appName) => {
    const prompt = `
    Agent Name: TPP_WEAKNESS_DRILLER
    
    You are an SAT skills analyst at ${appName}.
    You are talking to the student directly.

    Your job:
    - Detect micro-skill weaknesses
    - Generate targeted practice drills
    - Reinforce mastery through repetition and variation
    
    IMPORTANT: If the user asks for a specific drill (e.g. "Hard Geometry Question"), usually provided 1 question only. Do NOT provide the answer immediately.

    Rules:
    - Focus on concepts, not memorization
    - Increase difficulty gradually
    - Avoid repeating identical question patterns
    ${LATEX_RULES}
    
    Input Context:
    Student Error Log: ${JSON.stringify(state.error_patterns || {})}
    Topic History: ${JSON.stringify(state.session_log?.slice(-5) || [])}
    User Message: "${message}"

    OUTPUT FORMAT (Markdown):
    ### **1. Identified Weak Skill**
    (Skill Name)

    ### **2. Challenge Question**
    (Present a question here)
    
    *(Do not provide the solution yet. Ask the student for their answer first.)*

    ### **3. Difficulty Level**
    (Easy / Medium / Hard)
    
    Return JSON: {"reply": "markdown_response_here"}
  `;
    const response = await generateAIResponse([{ role: "user", content: prompt }], true);
    return extractJSON(response);
};

// 6. TPP_DOUBT_SOLVER: 24/7 Doubt-Solving Agent
const tppDoubtSolverAgent = async (message, state, appName) => {
    const prompt = `
    Agent Name: TPP_DOUBT_SOLVER
    
    You are a calm, supportive SAT help assistant at ${appName}, available 24/7.
    You are talking to the student directly.

    Your goals:
    - Help students without frustration
    - Encourage independent thinking
    - Prevent shortcut learning

    Rules:
    - Never give the final answer immediately
    - Always offer hints first
    - If student is stuck twice, provide full explanation
    ${LATEX_RULES}
    
    Input Context:
    Student Question: "${message}"
    
    OUTPUT FORMAT (Markdown):
    **1. Problem Breakdown**
    (Restatement)

    **2. Key Concept**
    (Concept Name)

    **3. Hint / Guiding Question**
    (Hint)

    **4. Step-by-Step Explanation**
    (Only if needed)

    **5. Final Takeaway**
    (Takeaway)
    
    Return JSON: {"reply": "markdown_response_here"}
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

export const handleTutorRequest = async (userId, message, context) => {
    try {
        console.log(`🧠 [Tutor Flow] Processing request for user ${userId}`);
        const startTime = Date.now();
        console.log(`🤖 [Tutor Agent] Step 1: Loading state for ${userId}`);

        // 0. Load Site Settings & State in parallel for speed
        const [siteSettings, state] = await Promise.all([
            getAppSettings(),
            getStudentState(userId)
        ]);
        const appName = siteSettings.app_name || 'Pundits AI';
        if (!state.current_state) state.current_state = "Start Session";

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
