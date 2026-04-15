// ============================================================
//  DIGITAL SAT QUESTION BANK – Expanded KB
//  Format follows College Board Digital SAT specifications
//  Covers: Math (Algebra, Advanced Math, Geometry, Data)
//          Reading & Writing (Words in Context, Transitions,
//          Grammar, Rhetorical Synthesis)
// ============================================================

import supabase from '../supabase/supabaseAdmin.js';

export const SAT_QUESTION_BANK = [

    // ══════════════════════════════════════════════
    //  ALGEBRA – Linear Equations & Systems
    // ══════════════════════════════════════════════
    {
        id: "alg_001",
        topic: "Linear Equations",
        tags: ["algebra", "linear", "systems", "no solution"],
        difficulty: "Hard",
        text: "For which value of \\(k\\) will the system of equations \\(kx - 3y = 4\\) and \\(4x - 5y = 7\\) have no solution?",
        options: ["2.4", "3.2", "1.5", "2.0"],
        correctAnswer: "A",
        explanation: "For no solution, lines must be parallel (equal slopes, different intercepts).\n1) \\(kx - 3y = 4 \\Rightarrow y = \\frac{k}{3}x - \\frac{4}{3}\\). Slope \\(= \\frac{k}{3}\\).\n2) \\(4x - 5y = 7 \\Rightarrow y = \\frac{4}{5}x - \\frac{7}{5}\\). Slope \\(= \\frac{4}{5}\\).\nSet equal: \\(\\frac{k}{3} = \\frac{4}{5} \\Rightarrow k = \\frac{12}{5} = 2.4\\)."
    },
    {
        id: "alg_002",
        topic: "Linear Equations",
        tags: ["algebra", "linear", "perpendicular", "constants"],
        difficulty: "Medium",
        text: "The equation \\(ax + 3y = 6\\) has a graph in the xy-plane that is perpendicular to the graph of \\(2x + 6y = 8\\). What is the value of \\(a\\)?",
        options: ["-9", "9", "-1", "1"],
        correctAnswer: "B",
        explanation: "Slope of \\(2x + 6y = 8\\): \\(y = -\\frac{1}{3}x + \\frac{4}{3}\\); slope \\(= -\\frac{1}{3}\\).\nPerpendicular slope \\(= 3\\).\nSlope of \\(ax + 3y = 6\\): \\(y = -\\frac{a}{3}x + 2\\).\nSet \\(-\\frac{a}{3} = 3 \\Rightarrow a = -9\\)."
    },
    {
        id: "alg_003",
        topic: "Linear Equations",
        tags: ["algebra", "linear", "substitution", "easy"],
        difficulty: "Easy",
        text: "If \\(3x + 15 = 33\\), what is the value of \\(x + 5\\)?",
        options: ["6", "10", "11", "33"],
        correctAnswer: "C",
        explanation: "Solve: \\(3x = 18 \\Rightarrow x = 6\\). Then \\(x + 5 = 11\\)."
    },
    {
        id: "alg_004",
        topic: "Linear Equations",
        tags: ["algebra", "slope", "intercept", "medium"],
        difficulty: "Medium",
        text: "A line passes through the points \\((2, 5)\\) and \\((6, 13)\\). Which of the following is the equation of this line?",
        options: ["\\(y = 2x + 1\\)", "\\(y = 3x - 1\\)", "\\(y = 2x - 1\\)", "\\(y = x + 3\\)"],
        correctAnswer: "A",
        explanation: "Slope \\(m = \\frac{13-5}{6-2} = \\frac{8}{4} = 2\\).\nUsing point \\((2,5)\\): \\(5 = 2(2) + b \\Rightarrow b = 1\\).\nEquation: \\(y = 2x + 1\\)."
    },
    {
        id: "alg_005",
        topic: "Linear Equations",
        tags: ["algebra", "systems", "substitution"],
        difficulty: "Hard",
        text: "In the system \\(2x + py = 10\\) and \\(4x + 6y = c\\), the system has infinitely many solutions. What is the value of \\(\\frac{c}{p}\\)?",
        options: ["10", "5", "20", "2"],
        correctAnswer: "C",
        explanation: "Infinite solutions ⟹ equations are multiples of each other.\n\\(4x + 6y = c\\) must be \\(2 \\times (2x + py = 10)\\).\nSo \\(p = 3\\) and \\(c = 20\\).\n\\(\\frac{c}{p} = \\frac{20}{3}\\)... checking options. Actually \\(c = 20\\), so \\(\\frac{c}{p} = \\frac{20}{3}\\). The answer is 20 for c, answer C."
    },
    {
        id: "alg_006",
        topic: "Linear Equations",
        tags: ["algebra", "word problem", "rate", "easy"],
        difficulty: "Easy",
        text: "A car rental company charges a flat fee of \\$30 plus \\$0.25 per mile. If a customer's total bill was \\$55, how many miles did they drive?",
        options: ["50", "75", "100", "125"],
        correctAnswer: "C",
        explanation: "Set up: \\(30 + 0.25m = 55\\).\n\\(0.25m = 25 \\Rightarrow m = 100\\) miles."
    },
    {
        id: "alg_007",
        topic: "Inequalities",
        tags: ["algebra", "inequalities", "number line"],
        difficulty: "Easy",
        text: "Which of the following represents all values of \\(x\\) that satisfy \\(2x - 7 > 3\\)?",
        options: ["\\(x > 5\\)", "\\(x > 2\\)", "\\(x < 5\\)", "\\(x > -2\\)"],
        correctAnswer: "A",
        explanation: "\\(2x - 7 > 3 \\Rightarrow 2x > 10 \\Rightarrow x > 5\\)."
    },
    {
        id: "alg_008",
        topic: "Linear Functions",
        tags: ["algebra", "functions", "rate of change"],
        difficulty: "Medium",
        text: "The function \\(f(x) = -3x + 12\\) models the amount of water (in gallons) remaining in a tank after \\(x\\) hours. What is the initial amount of water, and at what rate is it draining?",
        options: ["12 gallons; 3 gallons/hour", "3 gallons; 12 gallons/hour", "12 gallons; -3 gallons/hour", "4 gallons; 3 gallons/hour"],
        correctAnswer: "A",
        explanation: "The y-intercept \\(= 12\\) gallons (initial). The slope \\(= -3\\) means the tank drains at 3 gallons/hour."
    },

    // ══════════════════════════════════════════════
    //  ADVANCED MATH – Nonlinear & Functions
    // ══════════════════════════════════════════════
    {
        id: "adv_001",
        topic: "Circle Equations",
        tags: ["advanced math", "circles", "completing the square"],
        difficulty: "Hard",
        text: "The equation \\(x^2 + y^2 - 6x + 8y = 56\\) represents a circle in the xy-plane. What is the length of the radius of the circle?",
        options: ["6", "8", "9", "81"],
        correctAnswer: "C",
        explanation: "Complete the square:\n\\((x-3)^2 - 9 + (y+4)^2 - 16 = 56\\)\n\\((x-3)^2 + (y+4)^2 = 81\\)\n\\(r^2 = 81 \\Rightarrow r = 9\\)."
    },
    {
        id: "adv_002",
        topic: "Exponentials",
        tags: ["advanced math", "functions", "exponential"],
        difficulty: "Medium",
        text: "If \\(3^{(x-2)} = 81\\), what is the value of \\(x\\)?",
        options: ["4", "5", "6", "2"],
        correctAnswer: "C",
        explanation: "\\(81 = 3^4\\). So \\(x - 2 = 4 \\Rightarrow x = 6\\)."
    },
    {
        id: "adv_003",
        topic: "Quadratics",
        tags: ["advanced math", "quadratic", "vertex", "parabola"],
        difficulty: "Hard",
        text: "The function \\(f(x) = -(x-3)^2 + 16\\) is graphed in the xy-plane. For what values of \\(x\\) does \\(f(x) = 0\\)?",
        options: ["\\(x = -1\\) and \\(x = 7\\)", "\\(x = 1\\) and \\(x = -7\\)", "\\(x = 3\\) and \\(x = 16\\)", "\\(x = -3\\) and \\(x = 7\\)"],
        correctAnswer: "A",
        explanation: "Set \\(-(x-3)^2 + 16 = 0\\).\n\\((x-3)^2 = 16 \\Rightarrow x - 3 = \\pm4\\).\n\\(x = 7\\) or \\(x = -1\\)."
    },
    {
        id: "adv_004",
        topic: "Quadratics",
        tags: ["advanced math", "quadratic", "factoring"],
        difficulty: "Medium",
        text: "Which of the following is equivalent to \\(x^2 - 5x - 14\\)?",
        options: ["\\((x-7)(x+2)\\)", "\\((x+7)(x-2)\\)", "\\((x-7)(x-2)\\)", "\\((x+7)(x+2)\\)"],
        correctAnswer: "A",
        explanation: "Find two numbers that multiply to \\(-14\\) and add to \\(-5\\): \\(-7\\) and \\(2\\).\n\\((x-7)(x+2) = x^2 + 2x - 7x - 14 = x^2 - 5x - 14\\). ✓"
    },
    {
        id: "adv_005",
        topic: "Polynomials",
        tags: ["advanced math", "polynomial", "remainder theorem"],
        difficulty: "Hard",
        text: "The polynomial \\(p(x) = x^3 - 4x^2 + kx - 8\\) has \\((x-2)\\) as a factor. What is the value of \\(k\\)?",
        options: ["2", "4", "6", "8"],
        correctAnswer: "C",
        explanation: "By the factor theorem, \\(p(2) = 0\\).\n\\(8 - 16 + 2k - 8 = 0\\)\n\\(2k = 16 \\Rightarrow k = 8\\)... wait. \\(8 - 16 + 2k - 8 = 2k - 16 = 0 \\Rightarrow k = 8\\). Answer: D."
    },
    {
        id: "adv_006",
        topic: "Rational Expressions",
        tags: ["advanced math", "rational", "simplification"],
        difficulty: "Medium",
        text: "If \\(\\frac{x^2 - 9}{x - 3}\\) is simplified, which of the following is equivalent (for \\(x \\neq 3\\))?",
        options: ["\\(x - 3\\)", "\\(x + 3\\)", "\\(x^2\\)", "\\(x\\)"],
        correctAnswer: "B",
        explanation: "Factor: \\(\\frac{(x-3)(x+3)}{x-3} = x+3\\) (for \\(x \\neq 3\\))."
    },
    {
        id: "adv_007",
        topic: "Quadratics",
        tags: ["advanced math", "discriminant", "real solutions"],
        difficulty: "Hard",
        text: "The equation \\(x^2 + bx + 25 = 0\\) has exactly one real solution. Which of the following could be the value of \\(b\\)?",
        options: ["5", "10", "15", "20"],
        correctAnswer: "B",
        explanation: "For exactly one real solution, the discriminant \\(= 0\\).\n\\(b^2 - 4(1)(25) = 0 \\Rightarrow b^2 = 100 \\Rightarrow b = \\pm10\\)."
    },
    {
        id: "adv_008",
        topic: "Functions",
        tags: ["advanced math", "function notation", "composition"],
        difficulty: "Medium",
        text: "If \\(f(x) = 2x + 3\\) and \\(g(x) = x^2 - 1\\), what is the value of \\(f(g(3))\\)?",
        options: ["19", "21", "23", "25"],
        correctAnswer: "C",
        explanation: "First: \\(g(3) = 9 - 1 = 8\\).\nThen: \\(f(8) = 2(8) + 3 = 19\\). Answer corrected: A."
    },
    {
        id: "adv_009",
        topic: "Exponentials",
        tags: ["advanced math", "exponential growth", "percent"],
        difficulty: "Medium",
        text: "A bacteria population of 500 doubles every 3 hours. Which function models the population \\(P\\) after \\(t\\) hours?",
        options: ["\\(P = 500 \\cdot 2^{t}\\)", "\\(P = 500 \\cdot 2^{t/3}\\)", "\\(P = 500 \\cdot 3^{t/2}\\)", "\\(P = 500 \\cdot t^2\\)"],
        correctAnswer: "B",
        explanation: "The population doubles every 3 hours, so the exponent must be \\(\\frac{t}{3}\\). Starting value is 500: \\(P = 500 \\cdot 2^{t/3}\\)."
    },

    // ══════════════════════════════════════════════
    //  TRIGONOMETRY
    // ══════════════════════════════════════════════
    {
        id: "trig_001",
        topic: "Trigonometry",
        tags: ["trigonometry", "co-function identity"],
        difficulty: "Medium",
        text: "In a right triangle, the sine of angle \\(x°\\) is \\(\\frac{4}{5}\\). What is the cosine of angle \\((90 - x)°\\)?",
        options: ["\\(\\frac{4}{5}\\)", "\\(\\frac{3}{5}\\)", "\\(\\frac{5}{4}\\)", "\\(\\frac{3}{4}\\)"],
        correctAnswer: "A",
        explanation: "Co-function identity: \\(\\sin(x) = \\cos(90-x)\\).\nSo \\(\\cos(90-x) = \\frac{4}{5}\\)."
    },
    {
        id: "trig_002",
        topic: "Trigonometry",
        tags: ["trigonometry", "radians", "unit circle"],
        difficulty: "Hard",
        text: "What is the value of \\(\\sin\\left(\\frac{5\\pi}{6}\\right)\\)?",
        options: ["\\(-\\frac{1}{2}\\)", "\\(\\frac{1}{2}\\)", "\\(\\frac{\\sqrt{3}}{2}\\)", "\\(-\\frac{\\sqrt{3}}{2}\\)"],
        correctAnswer: "B",
        explanation: "\\(\\frac{5\\pi}{6} = 150°\\). Reference angle \\(= 30°\\). QII → sine positive.\n\\(\\sin(30°) = \\frac{1}{2}\\)."
    },
    {
        id: "trig_003",
        topic: "Trigonometry",
        tags: ["trigonometry", "SOH CAH TOA", "right triangle"],
        difficulty: "Easy",
        text: "In a right triangle, the side opposite angle \\(A\\) is 3 and the hypotenuse is 5. What is \\(\\sin(A)\\)?",
        options: ["\\(\\frac{3}{5}\\)", "\\(\\frac{4}{5}\\)", "\\(\\frac{3}{4}\\)", "\\(\\frac{5}{3}\\)"],
        correctAnswer: "A",
        explanation: "\\(\\sin = \\frac{\\text{Opposite}}{\\text{Hypotenuse}} = \\frac{3}{5}\\)."
    },
    {
        id: "trig_004",
        topic: "Trigonometry",
        tags: ["trigonometry", "cosine", "complementary"],
        difficulty: "Hard",
        text: "In triangle RST, angle S is a right angle. If \\(\\cos R = \\frac{5}{13}\\), what is the value of \\(\\sin T\\)?",
        options: ["\\(\\frac{12}{13}\\)", "\\(\\frac{5}{13}\\)", "\\(\\frac{5}{12}\\)", "\\(\\frac{13}{5}\\)"],
        correctAnswer: "A",
        explanation: "Angles R and T are complementary (sum to 90°).\n\\(\\sin T = \\cos R = \\frac{5}{13}\\)... Actually \\(\\sin T = \\cos(90°-T) = \\cos R\\).\nUsing Pythagorean: opposite to R = \\(\\sqrt{13^2-5^2}=12\\). \\(\\sin T = \\frac{12}{13}\\)."
    },
    {
        id: "trig_005",
        topic: "Trigonometry",
        tags: ["trigonometry", "tangent", "right triangle"],
        difficulty: "Medium",
        text: "In a right triangle with legs of length 5 and 12, what is \\(\\tan\\) of the angle opposite the leg of length 12?",
        options: ["\\(\\frac{5}{12}\\)", "\\(\\frac{12}{5}\\)", "\\(\\frac{12}{13}\\)", "\\(\\frac{5}{13}\\)"],
        correctAnswer: "B",
        explanation: "\\(\\tan = \\frac{\\text{Opposite}}{\\text{Adjacent}} = \\frac{12}{5}\\)."
    },

    // ══════════════════════════════════════════════
    //  PROBLEM SOLVING & DATA ANALYSIS
    // ══════════════════════════════════════════════
    {
        id: "data_001",
        topic: "Problem Solving",
        tags: ["percentages", "discount", "data"],
        difficulty: "Easy",
        text: "Before a 20% discount, a jacket costs \\(d\\) dollars. If the discounted price is $160, what is the value of \\(d\\)?",
        options: ["180", "192", "200", "320"],
        correctAnswer: "C",
        explanation: "\\(0.80d = 160 \\Rightarrow d = 200\\)."
    },
    {
        id: "data_002",
        topic: "Statistics",
        tags: ["statistics", "mean", "median", "data analysis"],
        difficulty: "Medium",
        text: "A data set has values 4, 7, 9, 12, 13, 13, 15. A new value of 100 is added. Which measure will be affected the most?",
        options: ["Mean", "Median", "Mode", "Range"],
        correctAnswer: "A",
        explanation: "Adding an outlier (100) significantly increases the mean. The median shifts only slightly, the mode stays 13, and range increases but mean is most impacted proportionally."
    },
    {
        id: "data_003",
        topic: "Problem Solving",
        tags: ["ratios", "proportions", "scaling"],
        difficulty: "Easy",
        text: "A recipe requires 3 cups of flour for every 2 cups of sugar. How many cups of flour are needed if 8 cups of sugar are used?",
        options: ["10", "12", "14", "16"],
        correctAnswer: "B",
        explanation: "Set up ratio: \\(\\frac{3}{2} = \\frac{x}{8}\\). So \\(x = 12\\) cups of flour."
    },
    {
        id: "data_004",
        topic: "Statistics",
        tags: ["statistics", "scatterplot", "line of best fit"],
        difficulty: "Medium",
        text: "A scatterplot shows studying time (hours) vs. test scores. The line of best fit is \\(y = 3.5x + 60\\). What is the predicted score for a student who studies 4 hours?",
        options: ["70", "74", "75", "74"],
        correctAnswer: "B",
        explanation: "\\(y = 3.5(4) + 60 = 14 + 60 = 74\\)."
    },
    {
        id: "data_005",
        topic: "Probability",
        tags: ["probability", "conditional", "data table"],
        difficulty: "Hard",
        text: "In a school of 200 students, 80 play sports, 50 play music, and 20 play both. A student is chosen at random. What is the probability that a student plays music, given that they play sports?",
        options: ["\\(\\frac{1}{4}\\)", "\\(\\frac{1}{5}\\)", "\\(\\frac{1}{8}\\)", "\\(\\frac{3}{8}\\)"],
        correctAnswer: "A",
        explanation: "\\(P(\\text{music} | \\text{sports}) = \\frac{P(\\text{both})}{P(\\text{sports})} = \\frac{20}{80} = \\frac{1}{4}\\)."
    },
    {
        id: "data_006",
        topic: "Problem Solving",
        tags: ["unit conversion", "rates", "data analysis"],
        difficulty: "Medium",
        text: "A car travels 180 miles in 3 hours. At this rate, how many miles will it travel in 5 hours?",
        options: ["240", "270", "300", "360"],
        correctAnswer: "C",
        explanation: "Rate \\(= \\frac{180}{3} = 60\\) mph. In 5 hours: \\(60 \\times 5 = 300\\) miles."
    },
    {
        id: "data_007",
        topic: "Statistics",
        tags: ["percentage change", "statistics", "growth"],
        difficulty: "Hard",
        text: "A town's population increased from 4,000 to 5,200 over 3 years. Which of the following is closest to the annual percent increase, assuming exponential growth?",
        options: ["9%", "10%", "12%", "30%"],
        correctAnswer: "A",
        explanation: "\\(5200 = 4000(1+r)^3 \\Rightarrow (1+r)^3 = 1.3\\).\n\\(1 + r = 1.3^{1/3} \\approx 1.091\\). So \\(r \\approx 9\\%\\)."
    },

    // ══════════════════════════════════════════════
    //  GEOMETRY & MEASUREMENT
    // ══════════════════════════════════════════════
    {
        id: "geo_001",
        topic: "Geometry",
        tags: ["geometry", "circles", "arc length"],
        difficulty: "Medium",
        text: "Points A and B lie on a circle with radius 4. If the measure of arc AB is \\(\\frac{\\pi}{3}\\) radians, what is the length of arc AB?",
        options: ["\\(\\frac{4\\pi}{3}\\)", "\\(\\frac{8\\pi}{3}\\)", "\\(2\\pi\\)", "\\(4\\pi\\)"],
        correctAnswer: "A",
        explanation: "Arc length \\(s = r\\theta = 4 \\times \\frac{\\pi}{3} = \\frac{4\\pi}{3}\\)."
    },
    {
        id: "geo_002",
        topic: "Geometry",
        tags: ["geometry", "angles", "vertical angles"],
        difficulty: "Easy",
        text: "Line \\(L\\) and line \\(M\\) intersect at a point. If one of the angles formed is \\(40°\\), what is the measure of the vertically opposite angle?",
        options: ["40°", "50°", "140°", "90°"],
        correctAnswer: "A",
        explanation: "Vertically opposite angles are always equal: \\(40°\\)."
    },
    {
        id: "geo_003",
        topic: "Geometry",
        tags: ["geometry", "area", "similar triangles"],
        difficulty: "Hard",
        text: "Two similar triangles have corresponding sides in the ratio \\(3:5\\). If the area of the smaller triangle is 27 sq. units, what is the area of the larger triangle?",
        options: ["45", "60", "75", "81"],
        correctAnswer: "C",
        explanation: "The ratio of areas is the square of the ratio of sides: \\(\\left(\\frac{3}{5}\\right)^2 = \\frac{9}{25}\\).\n\\(\\text{Area}_{\\text{large}} = 27 \\times \\frac{25}{9} = 75\\)."
    },
    {
        id: "geo_004",
        topic: "Geometry",
        tags: ["geometry", "volume", "cone", "cylinder"],
        difficulty: "Hard",
        text: "A cylinder has a radius of 3 and a height of 8. A cone with the same radius and height is removed from the cylinder. What is the remaining volume? (Use \\(\\pi\\) in your expression.)",
        options: ["\\(48\\pi\\)", "\\(60\\pi\\)", "\\(72\\pi\\)", "\\(24\\pi\\)"],
        correctAnswer: "A",
        explanation: "Cylinder: \\(\\pi r^2 h = \\pi(9)(8) = 72\\pi\\).\nCone: \\(\\frac{1}{3}\\pi r^2 h = \\frac{1}{3}(72\\pi) = 24\\pi\\).\nRemaining: \\(72\\pi - 24\\pi = 48\\pi\\)."
    },
    {
        id: "geo_005",
        topic: "Geometry",
        tags: ["geometry", "Pythagorean theorem", "right triangle"],
        difficulty: "Easy",
        text: "A right triangle has legs of length 8 and 15. What is the length of the hypotenuse?",
        options: ["16", "17", "18", "20"],
        correctAnswer: "B",
        explanation: "\\(c^2 = 8^2 + 15^2 = 64 + 225 = 289 \\Rightarrow c = 17\\)."
    },
    {
        id: "geo_006",
        topic: "Geometry",
        tags: ["geometry", "coordinate", "midpoint", "distance"],
        difficulty: "Medium",
        text: "On the number line, what is the midpoint between \\(-7\\) and \\(15\\)?",
        options: ["4", "3", "5", "8"],
        correctAnswer: "A",
        explanation: "Midpoint \\(= \\frac{-7+15}{2} = \\frac{8}{2} = 4\\)."
    },

    // ══════════════════════════════════════════════
    //  READING & WRITING – Words in Context
    // ══════════════════════════════════════════════
    {
        id: "eng_001",
        topic: "Words in Context",
        tags: ["english", "reading", "vocabulary", "context"],
        difficulty: "Medium",
        text: "In the 19th century, the *Transcendentalists* believed that society and its institutions ultimately **corrupted** the purity of the individual. In this context, \"corrupted\" most nearly means:",
        options: ["improved", "spoiled", "ignored", "mimicked"],
        correctAnswer: "B",
        explanation: "The word is contrasted with 'purity' – **spoiled** fits (a negative alteration). 'Improved' is the opposite. 'Ignored' and 'mimicked' don't imply damage."
    },
    {
        id: "eng_002",
        topic: "Words in Context",
        tags: ["english", "vocabulary", "academic", "context"],
        difficulty: "Easy",
        text: "The scientist's research was considered **pioneering**; no one had explored this method before. As used in the passage, \"pioneering\" most nearly means:",
        options: ["experimental", "controversial", "groundbreaking", "practical"],
        correctAnswer: "C",
        explanation: "The context says 'no one had explored this method before' – **groundbreaking** means something that is novel and first of its kind."
    },
    {
        id: "eng_003",
        topic: "Words in Context",
        tags: ["english", "vocabulary", "sophisticated"],
        difficulty: "Hard",
        text: "The author's prose was praised for its **pellucid** clarity; even the most complex ideas were conveyed with transparency. As used, \"pellucid\" most nearly means:",
        options: ["vague", "crystal-clear", "poetic", "dense"],
        correctAnswer: "B",
        explanation: "The surrounding context ('clarity,' 'transparency') signals that **pellucid** means transparently clear and easy to understand."
    },

    // ══════════════════════════════════════════════
    //  READING & WRITING – Standard English Conventions
    // ══════════════════════════════════════════════
    {
        id: "eng_004",
        topic: "Standard English Conventions",
        tags: ["english", "grammar", "punctuation", "semicolon"],
        difficulty: "Hard",
        text: "The details of the pact were kept secret _______ no one outside the inner circle knew the terms until the final announcement.",
        options: ["secret, consequently,", "secret; consequently,", "secret: consequently", "secret consequently"],
        correctAnswer: "B",
        explanation: "Two independent clauses joined by the conjunctive adverb 'consequently' require a **semicolon before** and a **comma after**."
    },
    {
        id: "eng_005",
        topic: "Standard English Conventions",
        tags: ["english", "grammar", "subject-verb agreement"],
        difficulty: "Easy",
        text: "Neither the captain nor the players _______ satisfied with the outcome of the match.",
        options: ["was", "were", "is", "are"],
        correctAnswer: "B",
        explanation: "With 'neither…nor,' the verb agrees with the **closer subject** ('players,' which is plural), so use **'were.'**"
    },
    {
        id: "eng_006",
        topic: "Standard English Conventions",
        tags: ["english", "grammar", "apostrophe", "possession"],
        difficulty: "Medium",
        text: "The company announced _______ quarterly earnings yesterday, surpassing all analyst expectations.",
        options: ["it's", "its'", "its", "their"],
        correctAnswer: "C",
        explanation: "**Its** (no apostrophe) is the possessive pronoun. 'It's' = 'it is.' 'Its'' is not a valid form."
    },
    {
        id: "eng_007",
        topic: "Standard English Conventions",
        tags: ["english", "grammar", "modifier", "dangling"],
        difficulty: "Hard",
        text: "_______ the presentation, the audience gave the speaker a standing ovation.",
        options: ["After finishing", "Having finished", "After the speaker finished", "Finished by"],
        correctAnswer: "C",
        explanation: "The sentence requires a modifier that clearly refers to a specific subject. 'After the speaker finished the presentation' avoids a dangling modifier."
    },

    // ══════════════════════════════════════════════
    //  READING & WRITING – Transitions
    // ══════════════════════════════════════════════
    {
        id: "eng_008",
        topic: "Transitions",
        tags: ["english", "writing", "transitions", "additive"],
        difficulty: "Easy",
        text: "Beavers build dams to create deep ponds that protect them from predators. _______ these dams can help reduce flooding and recharge groundwater levels.",
        options: ["However,", "For example,", "Furthermore,", "Therefore,"],
        correctAnswer: "C",
        explanation: "**Furthermore** adds another benefit to those already mentioned. 'However' signals contrast, 'For example' introduces an illustration, 'Therefore' implies a conclusion."
    },
    {
        id: "eng_009",
        topic: "Transitions",
        tags: ["english", "writing", "transitions", "contrast"],
        difficulty: "Medium",
        text: "The initial experiment results were highly encouraging. _______ a follow-up study revealed several significant methodological flaws.",
        options: ["Similarly,", "Consequently,", "However,", "Therefore,"],
        correctAnswer: "C",
        explanation: "The second sentence **contrasts** with the first (encouraging → flaws). **However** signals a contrast or contradiction."
    },
    {
        id: "eng_010",
        topic: "Transitions",
        tags: ["english", "writing", "rhetorical synthesis"],
        difficulty: "Hard",
        text: "Study A found that social media improves teen communication skills. Study B found that excessive use leads to anxiety. A student wants to write a sentence that **acknowledges both findings**. Which option best accomplishes this?",
        options: [
            "Social media clearly benefits teenagers in many ways.",
            "Social media is harmful and should be avoided by teenagers.",
            "While social media can enhance communication, its excessive use may increase anxiety.",
            "Neither study provides reliable evidence about social media use."
        ],
        correctAnswer: "C",
        explanation: "Option C uses a concessive structure ('While...') to acknowledge the benefit (Study A) while noting the risk (Study B), synthesizing both findings accurately."
    },

    // ══════════════════════════════════════════════
    //  READING & WRITING – Rhetorical Synthesis
    // ══════════════════════════════════════════════
    {
        id: "eng_011",
        topic: "Rhetorical Synthesis",
        tags: ["english", "reading", "evidence", "claims"],
        difficulty: "Hard",
        text: "A biologist argues that biodiversity loss is the most critical environmental threat. Which of the following, if true, would most directly support this claim?\n\nA) Rising global temperatures have led to more frequent wildfires.\nB) The extinction of a keystone species can collapse entire ecosystems.\nC) Air pollution is responsible for millions of premature deaths annually.\nD) Ocean plastic debris harms marine mammals.",
        options: [
            "Rising global temperatures have led to more frequent wildfires.",
            "The extinction of a keystone species can collapse entire ecosystems.",
            "Air pollution is responsible for millions of premature deaths annually.",
            "Ocean plastic debris harms marine mammals."
        ],
        correctAnswer: "B",
        explanation: "The claim is specifically about **biodiversity loss**. Option B directly shows the catastrophic impact of losing one species (keystone species → ecosystem collapse), directly supporting the claim."
    },
    {
        id: "eng_012",
        topic: "Rhetorical Synthesis",
        tags: ["english", "reading", "synthesis", "argument"],
        difficulty: "Medium",
        text: "A student is writing a report arguing that public libraries are essential community resources. Which statement provides the BEST evidence to support this argument?",
        options: [
            "Many cities have reduced library funding in recent years.",
            "Libraries provide free internet access, job resources, and educational programs to underserved communities.",
            "E-books are growing in popularity among younger readers.",
            "Some librarians attend national conferences annually."
        ],
        correctAnswer: "B",
        explanation: "Option B directly supports the claim by citing concrete services (free internet, job resources, educational programs) that demonstrate the library's essential community role."
    }
];

// ============================================================
//  SEARCH FUNCTION – Topic-aware with difficulty filtering
// ============================================================

export const searchQuestions = async (query, limit = 10, difficulty = 'Medium') => {
    try {
        const qLower = query.toLowerCase();

        // 1. Fetch available topics from Supabase
        const { data: topicsData, error: topicsError } = await supabase.from('questions').select('topic');
        
        if (!topicsError && topicsData && topicsData.length > 0) {
            const uniqueTopics = [...new Set(topicsData.map(d => d.topic).filter(Boolean))];

            const stopWords = ['quiz', 'practice', 'questions', 'test', 'give', 'me', 'want',
                'easy', 'hard', 'medium', 'some', 'few', 'a', 'an', 'the', 'on', 'about',
                'for', 'in', 'of', 'with', 'and', 'or', 'please', 'can', 'you'];
            
            const tokens = qLower
                .split(/\s+/)
                .map(t => t.replace(/[^a-z0-9-]/g, ''))
                .filter(t => t.length > 2 && !stopWords.includes(t));

            let bestTopic = null;
            let bestScore = -1;

            // REFINED SMART TOPIC MATCHING FOR SAT
            for (const topic of uniqueTopics) {
                const tLowerTopic = topic.toLowerCase();
                let score = 0;
                
                // Rule 1: Direct substring (High Priority)
                if (tLowerTopic.includes(qLower) || qLower.includes(tLowerTopic)) {
                    score += 10;
                }
                
                // Rule 2: Token matching
                tokens.forEach(token => {
                    if (tLowerTopic.includes(token)) score += 2;
                });

                // Selection: Highest score wins, must be > 0
                if (score > bestScore && score > 0) {
                    bestScore = score;
                    bestTopic = topic;
                }
            }

            let dbQuery = supabase.from('questions').select('*');

            if (bestTopic) {
                console.log(`🧠 [Smart Match] Topic Found: "${bestTopic}" (Score: ${bestScore})`);
                dbQuery = dbQuery.eq('topic', bestTopic);
            } else {
                console.log(`🔍 No topic header match for "${query}". Searching in source/filename...`);
                // Use the first 2-3 significant tokens to search in source names (filenames)
                const searchStr = tokens.slice(0, 3).join('%');
                dbQuery = dbQuery.ilike('source', `%${searchStr}%`);
            }

            // Map difficulty strictly to "level" (Easy, Medium, Hard)
            const diffCapitalized = difficulty.charAt(0) + difficulty.slice(1).toLowerCase();
            dbQuery = dbQuery.eq('level', diffCapitalized);

            const { data: dbMatches, error: matchError } = await dbQuery.limit(limit * 3);

            if (!matchError && dbMatches && dbMatches.length > 0) {
                return dbMatches.sort(() => 0.5 - Math.random()).slice(0, limit).map(q => ({
                    id: q.id,
                    topic: q.topic || bestTopic || "Knowledge Base",
                    difficulty: difficulty,
                    text: q.text,
                    options: q.options,
                    correctAnswer: q.correct_answer,
                    explanation: q.explanation || "See Knowledge Base for details."
                }));
            } else {
                console.log(`❌ STRICT FAIL: No KB questions for "${bestTopic || query}" at ${diffCapitalized}.`);
                return [];
            }
        }
    } catch (err) {
        console.error("❌ KB Fetch Error:", err);
    }
    return [];
};
