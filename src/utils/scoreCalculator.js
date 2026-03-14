// SAT SCORING CONSTANTS (Refined Model)
const SCORING_CONFIG = {
  MATH: {
    QUESTIONS: 22,
    LEVELS: {
      'Easy': { min: 200, max: 500 },
      'Medium': { min: 400, max: 650 },
      'Hard': { min: 550, max: 800 }
    }
  },
  RW: {
    QUESTIONS: 27,
    LEVELS: {
      'Easy': { min: 200, max: 480 },
      'Medium': { min: 380, max: 650 },
      'Hard': { min: 550, max: 800 }
    }
  }
};

export const getCategory = (item) => {
  if (!item) return 'RW';

  // Handle both flat objects and nested courses objects
  const type = (item.tutor_type || item.courses?.tutor_type || '').toLowerCase();
  const name = (item.name || item.courses?.name || '').toLowerCase();

  // RW Keywords (Added 'r & d', 'verbal', 'literacy') - CHECK THESE FIRST
  if (
    type.includes('reading') || type.includes('writing') || 
    type.includes('verbal') || type.includes('rw') ||
    name.includes('english') || name.includes('reading') || 
    name.includes('writing') || name.includes('verbal') || 
    name.includes('grammar') || name.includes('r & d') || 
    name.includes('r&d') || name.includes('literacy')
  ) return 'RW';

  // Math Keywords
  if (
    type.includes('math') || type.includes('quant') || 
    name.includes('math') || name.includes('algebra') || 
    name.includes('geometry') || name.includes('calc') ||
    name.includes('quant')
  ) return 'MATH';

  return 'RW'; // Default fallback
};

// Core Score Calculation Helper
export const calculateSessionScore = (category, levelName, percentageScore) => {
  const config = SCORING_CONFIG[category];
  // Default to Medium if unknown level
  const levelStats = config.LEVELS[levelName] || config.LEVELS['Medium'];

  const ratio = (percentageScore || 0) / 100;
  const levelMax = levelStats.max;
  const levelMin = levelStats.min;

  // Formula: Level_Min + (Correct_Ratio * (Level_Max - Level_Min))
  const finalScore = levelMin + (ratio * (levelMax - levelMin));

  return Math.round(finalScore);
};

export const calculateSatScore = (easy, medium, hard) => {
  const weightedAccuracy =
    (easy * 0.20) +
    (medium * 0.35) +
    (hard * 0.45);

  const finalScore = 200 + (weightedAccuracy / 100) * 600;

  return Math.round(finalScore);
};

export const calculateStudentScore = (progressData, diagnosticData, submissionsData = []) => {
  // 1. Establish Goals
  let target = 1500;
  if (diagnosticData && diagnosticData.targetScore) {
    target = parseInt(diagnosticData.targetScore) || 1500;
  }

  // 2. Identify Section Baselines (From Diagnostics)
  const baselineMath = diagnosticData ? (parseInt(diagnosticData.mathScore) || 200) : 200;
  const baselineRW = diagnosticData ? (parseInt(diagnosticData.rwScore) || 200) : 200;

  // 3. Track REAL Test Performance (Ignore Lessons/Quizzes for main score)
  // We need the LATEST and BEST actual recorded test results
  let latestMathTest = 0;
  let latestMathDate = 0;
  let maxMathTest = 0;

  let latestRWTest = 0;
  let latestRWDate = 0;
  let maxRWTest = 0;

  if (Array.isArray(submissionsData)) {
    submissionsData.forEach(sub => {
      const cat = getCategory(sub);
      const level = sub.level ? sub.level.charAt(0).toUpperCase() + sub.level.slice(1).toLowerCase() : 'Medium';
      const testDate = new Date(sub.test_date || sub.created_at).getTime();
      
      // Get the REAL scaled score from this test record
      let mathVal = sub.math_scaled_score || 0;
      let rwVal = (sub.reading_scaled_score || 0) + (sub.writing_scaled_score || 0);

      // Fallback: If no scaled score is saved in DB, calculate it DIRECTLY from this test's accuracy
      // Rule: Simple Linear Scaling (ACC% * 600 + 200 floor) - This is an "Actual" representation of this test.
      if (!mathVal && !rwVal) {
        if (sub.scaled_score > 0) {
           // If combined scaled score exists
           if (sub.scaled_score <= 800) {
              if (cat === 'MATH') mathVal = sub.scaled_score;
              else rwVal = sub.scaled_score;
           } else {
              // Full test: Split 50/50 if not specified (Emergency fallback)
              mathVal = Math.round(sub.scaled_score / 2);
              rwVal = sub.scaled_score - mathVal;
           }
        } else {
           // No scaled score at all: Calculate from accuracy of THIS SPECIFIC TEST only
           const calculated = calculateSessionScore(cat, level, sub.raw_score_percentage);
           if (cat === 'MATH') mathVal = calculated;
           else rwVal = calculated;
        }
      }

      // Track Max (Record Highs)
      if (mathVal > maxMathTest) maxMathTest = mathVal;
      if (rwVal > maxRWTest) maxRWTest = rwVal;

      // Track Latest (Dashboard Priority)
      if (mathVal > 0 && testDate >= latestMathDate) {
        latestMathDate = testDate;
        latestMathTest = mathVal;
      }
      if (rwVal > 0 && testDate >= latestRWDate) {
        latestRWDate = testDate;
        latestRWTest = rwVal;
      }
    });
  }

  // 4. FINAL SCORE SELECTION (PRIORITIZE ACTUAL TEST RECORDS)
  // Rule: LATEST TEST > BEST TEST > DIAGNOSTIC BASELINE
  // We NEVER use "Estimated Accuracy" from cross-course progress anymore.
  
  let displayMath = latestMathTest || maxMathTest || baselineMath;
  let displayRW = latestRWTest || maxRWTest || baselineRW;

  // Sanity check SAT bounds
  displayMath = Math.min(800, Math.max(200, displayMath));
  displayRW = Math.min(800, Math.max(200, displayRW));

  const total = displayMath + displayRW;
  const baselineTotal = baselineMath + baselineRW;

  return {
    current: total,
    math: displayMath,
    rw: displayRW,
    bestMath: Math.max(displayMath, maxMathTest),
    bestRW: Math.max(displayRW, maxRWTest),
    latestMath: latestMathTest,
    latestRW: latestRWTest,
    target: target,
    gap: Math.max(0, target - total),
    baselineTotal: baselineTotal,
    totalImprovement: Math.max(0, total - baselineTotal),
    mathImprovement: Math.max(0, displayMath - baselineMath),
    rwImprovement: Math.max(0, displayRW - baselineRW),
    isMathMaxed: displayMath >= 800,
    isRWMaxed: displayRW >= 800
  };
};