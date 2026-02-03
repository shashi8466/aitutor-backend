
export const SAT_QUESTION_BANK = [
    // --- ALGEBRA: Linear Equations & Systems ---
    {
        id: "alg_001",
        topic: "Linear Equations",
        tags: ["algebra", "linear", "systems", "no solution"],
        difficulty: "Hard",
        text: "For which value of **k** will the system of equations \\(kx - 3y = 4\\) and \\(4x - 5y = 7\\) have no solution?",
        options: ["2.4", "3.2", "1.5", "2.0"],
        correctAnswer: "A",
        explanation: "For a system to have no solution, the lines must be parallel (same slope, different y-intercept). Convert to slope-intercept form (\\(y = mx + b\\)).\n1) \\(kx - 3y = 4 \\rightarrow -3y = -kx + 4 \\rightarrow y = \\frac{k}{3}x - \\frac{4}{3}\\). Slope \\(m_1 = \\frac{k}{3}\\).\n2) \\(4x - 5y = 7 \\rightarrow -5y = -4x + 7 \\rightarrow y = \\frac{4}{5}x - \\frac{7}{5}\\). Slope \\(m_2 = \\frac{4}{5}\\).\nSet slopes equal: \\(\\frac{k}{3} = \\frac{4}{5} \\rightarrow 5k = 12 \\rightarrow k = 2.4\\)."
    },
    {
        id: "alg_002",
        topic: "Linear Equations",
        tags: ["algebra", "linear", "constants"],
        difficulty: "Medium",
        text: "The equation \\(ax + 3y = 6\\) has a graph in the xy-plane that is perpendicular to the graph of the equation \\(2x + 6y = 8\\). What is the value of **a**?",
        options: ["-9", "9", "-1", "1"],
        correctAnswer: "B",
        explanation: "Find the slope of the second line: \\(6y = -2x + 8 \\rightarrow y = -\\frac{1}{3}x + \\frac{4}{3}\\). Slope is \\(-\\frac{1}{3}\\).\nSince the lines are perpendicular, the slope of the first line must be the negative reciprocal, which is 3.\nSlope of first line: \\(3y = -ax + 6 \\rightarrow y = -\\frac{a}{3}x + 2\\).\nSet \\(-\\frac{a}{3} = 3 \\rightarrow -a = 9 \\rightarrow a = -9\\)."
    },
    {
        id: "alg_003",
        topic: "Linear Equations",
        tags: ["algebra", "linear", "solving"],
        difficulty: "Easy",
        text: "If \\(3x + 15 = 33\\), what is the value of \\(x + 5\\)?",
        options: ["6", "10", "11", "33"],
        correctAnswer: "C",
        explanation: "First, solve for x: \\(3x = 18 \\rightarrow x = 6\\).\nThen find \\(x + 5\\): \\(6 + 5 = 11\\)."
    },

    // --- ADVANCED MATH: Nonlinear ---
    {
        id: "adv_001",
        topic: "Circle Equations",
        tags: ["advanced math", "circles", "geometry"],
        difficulty: "Hard",
        text: "The equation \\(x^2 + y^2 - 6x + 8y = 56\\) represents a circle in the xy-plane. What is the length of the radius of the circle?",
        options: ["6", "8", "9", "81"],
        correctAnswer: "C",
        explanation: "Complete the square for x and y.\n\\((x^2 - 6x) + (y^2 + 8y) = 56\\)\n\\((x - 3)^2 - 9 + (y + 4)^2 - 16 = 56\\)\n\\((x - 3)^2 + (y + 4)^2 = 56 + 9 + 16\\)\n\\((x - 3)^2 + (y + 4)^2 = 81\\)\nThe radius squared \\(r^2 = 81\\), so \\(r = 9\\)."
    },
    {
        id: "adv_002",
        topic: "Exponentials",
        tags: ["advanced math", "functions", "exponential"],
        difficulty: "Medium",
        text: "If \\(3^{(x-2)} = 81\\), what is the value of **x**?",
        options: ["4", "5", "6", "2"],
        correctAnswer: "C",
        explanation: "\\(81\\) can be rewritten as \\(3^4\\).\nSo, \\(3^{(x-2)} = 3^4\\).\nSince bases are equal, exponents must be equal: \\(x - 2 = 4 \\rightarrow x = 6\\)."
    },

    // --- TRIGONOMETRY ---
    {
        id: "trig_001",
        topic: "Trigonometry",
        tags: ["trigonometry", "geometry", "sine/cosine"],
        difficulty: "Medium",
        text: "In a right triangle, the sine of angle \\(x^\\circ\\) is \\(\\frac{4}{5}\\). What is the cosine of angle \\((90 - x)^\\circ\\)?",
        options: ["4/5", "3/5", "5/4", "3/4"],
        correctAnswer: "A",
        explanation: "This uses the co-function identity: \\(\\sin(x) = \\cos(90 - x)\\).\nSince \\(\\sin(x) = \\frac{4}{5}\\), then \\(\\cos(90 - x)\\) must also be \\(\\frac{4}{5}\\)."
    },
    {
        id: "trig_002",
        topic: "Trigonometry",
        tags: ["trigonometry", "radians", "unit circle"],
        difficulty: "Hard",
        text: "What is the value of \\(\\sin(\\frac{5\\pi}{6})\\)?",
        options: ["-1/2", "1/2", "root(3)/2", "-root(3)/2"],
        correctAnswer: "B",
        options_viz: ["-1/2", "1/2", "\\frac{\\sqrt{3}}{2}", "-\\frac{\\sqrt{3}}{2}"],
        explanation: "\\(\\frac{5\\pi}{6}\\) radians is \\(150^\\circ\\), which is in Quadrant II. The reference angle is \\(\\frac{\\pi}{6}\\) (or \\(30^\\circ\\)).\nIn Quadrant II, sine is positive.\n\\(\\sin(30^\\circ) = \\frac{1}{2}\\), so \\(\\sin(150^\\circ) = \\frac{1}{2}\\)."
    },
    {
        id: "trig_003",
        topic: "Trigonometry",
        tags: ["trigonometry", "triangles", "SOH CAH TOA"],
        difficulty: "Easy",
        text: "In a right triangle, the side opposite angle A is 3 and the hypotenuse is 5. What is \\(\\sin(A)\\)?",
        options: ["3/5", "4/5", "3/4", "5/3"],
        correctAnswer: "A",
        explanation: "Sine is defined as Opposite/Hypotenuse.\nOpposite = 3, Hypotenuse = 5.\nSo \\(\\sin(A) = \\frac{3}{5}\\)."
    },

    // --- PROBLEM SOLVING & DATA ---
    {
        id: "data_001",
        topic: "Problem Solving",
        tags: ["percentages", "ratios", "data"],
        difficulty: "Easy",
        text: "Before a 20% discount, a jacket costs \\(d\\) dollars. If the discounted price is $160, what is the value of \\(d\\)?",
        options: ["180", "192", "200", "320"],
        correctAnswer: "C",
        explanation: "A 20% discount means the price is 80% of original.\n\\(0.80d = 160\\)\n\\(d = \\frac{160}{0.80} = 200\\)."
    },

    // --- GEOMETRY ---
    {
        id: "geo_001",
        topic: "Geometry",
        tags: ["geometry", "circles", "angles"],
        difficulty: "medium",
        text: "Points A and B lie on a circle with radius 4. If the measure of arc AB is \\(\\frac{\\pi}{3}\\) radians, what is the length of arc AB?",
        options: ["4pi/3", "8pi/3", "2pi", "4pi"],
        correctAnswer: "A",
        options_viz: ["\\frac{4\\pi}{3}", "\\frac{8\\pi}{3}", "2\\pi", "4\\pi"],
        explanation: "Arc length \\(s = r\\theta\\), where \\(r\\) is radius and \\(\\theta\\) is angle in radians.\n\\(s = 4 \\times \\frac{\\pi}{3} = \\frac{4\\pi}{3}\\)."
    },
    {
        id: "geo_002",
        topic: "Geometry",
        tags: ["geometry", "lines", "angles"],
        difficulty: "Easy",
        text: "Line \\(L\\) and line \\(M\\) intersect at a point. If one of the angles formed is \\(40^\\circ\\), what is the measure of the angle vertically opposite to it?",
        options: ["40", "50", "140", "90"],
        correctAnswer: "A",
        explanation: "Vertically opposite angles are equal.\nIf one angle is \\(40^\\circ\\), the opposite angle is also \\(40^\\circ\\)."
    },

    // --- ENGLISH: Reading & Writing ---
    {
        id: "eng_001",
        topic: "Words in Context",
        tags: ["english", "reading", "vocabulary", "context"],
        difficulty: "Medium",
        text: "In the 19th century, the *Transcendentalists* believed that society and its institutions—particularly organized religion and political parties—ultimately corrupted the purity of the individual. They had faith that people are at their best when truly \"self-reliant\" and independent. In this context, \"corrupted\" most nearly means:",
        options: ["improved", "spoiled", "ignored", "mimicked"],
        correctAnswer: "B",
        explanation: "**Spoiled** is the correct answer. The text contrasts 'corrupted' with 'purity', suggesting a negative change or tainting. 'Improved' is the opposite; 'ignored' and 'mimicked' do not fit the context of damaging purity."
    },
    {
        id: "eng_002",
        topic: "Standard English Conventions",
        tags: ["english", "grammar", "punctuation", "boundaries"],
        difficulty: "Hard",
        text: "The details of the pact were kept secret ______ no one outside the inner circle knew the terms until the final announcement.",
        options: ["secret, consequently,", "secret; consequently,", "secret: consequently", "secret consequently"],
        correctAnswer: "B",
        explanation: "**B** is correct. Two independent clauses ('The details... secret' and 'no one... terms') are joined by a conjunctive adverb ('consequently'). This requires a semicolon before and a comma after."
    },
    {
        id: "eng_003",
        topic: "Transitions",
        tags: ["english", "writing", "transitions", "logic"],
        difficulty: "Easy",
        text: "Beavers build dams to create deep ponds that protect them from predators. _______ these dams can help reduce flooding and recharge groundwater levels.",
        options: ["However,", "For example,", "Furthermore,", "Therefore,"],
        correctAnswer: "C",
        explanation: "**Furthermore** is the correct transition. The second sentence adds another benefit of beaver dams (environmental) to the first benefit (protection). It continues the same line of positive reasoning."
    }
];

export const searchQuestions = (query, limit = 5, difficulty = 'Medium') => {
    const qLower = query.toLowerCase();
    const tokens = qLower.split(/\s+/).filter(t => t.length > 2 && !['quiz', 'practice', 'questions', 'test', 'give', 'easy', 'hard', 'medium', 'want'].includes(t));

    // If no useful tokens (e.g. just "quiz"), fallback to broad search
    if (tokens.length === 0) {
        // If they just said "quiz", return a random mix from KB
        const shuffled = SAT_QUESTION_BANK.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, limit);
    }

    // Robust Fuzzy Search: Check if ANY significant token matches data
    let matches = SAT_QUESTION_BANK.filter(q => {
        return tokens.some(token =>
            q.topic.toLowerCase().includes(token) ||
            q.tags.some(t => t.toLowerCase().includes(token)) ||
            q.text.toLowerCase().includes(token)
        );
    });

    // Fallback: If strict token match failed but it looks like a generic math request
    if (matches.length === 0 && (qLower.includes('math'))) {
        matches = SAT_QUESTION_BANK;
    }

    // Filter by difficulty (Soft Filter)
    const difficultMatches = matches.filter(q => q.difficulty.toLowerCase() === difficulty.toLowerCase());

    // ONLY filter by difficulty if we actually have matches for that difficulty.
    // Otherwise, show whatever matches the TOPIC (better to show Hard Trig than nothing for "Easy Trig" if we don't have Easy Trig)
    if (difficultMatches.length > 0) {
        matches = difficultMatches;
    }

    // Shuffle and slice
    const shuffled = matches.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, limit);
};
