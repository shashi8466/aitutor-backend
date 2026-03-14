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

export const calculateStudentScore = (progressData, diagnosticData, submissionsData = []) => {
  // 1. Establish Goals
  let target = 1500;
  if (diagnosticData && diagnosticData.targetScore) {
    target = parseInt(diagnosticData.targetScore) || 1500;
  }

  // 2. Initialize Accuracies
  const mathAcc = { Easy: 0, Medium: 0, Hard: 0 };
  const rwAcc = { Easy: 0, Medium: 0, Hard: 0 };
  
  // Track best actual test scores
  let maxMathTest = 0;
  let maxRWTest = 0;
  
  // Track latest actual test scores (per user request)
  let latestMathTest = 0;
  let latestRWTest = 0;
  let latestMathDate = 0;
  let latestRWDate = 0;

  // 3. Process Progress (Lessons) to find BEST performance per level
  if (Array.isArray(progressData)) {
    progressData.forEach(item => {
      const cat = getCategory(item);
      const level = item.level ? item.level.charAt(0).toUpperCase() + item.level.slice(1).toLowerCase() : 'Medium';
      const score = item.score || 0;

      if (cat === 'MATH') {
        if (score > mathAcc[level]) mathAcc[level] = score;
      } else {
        if (score > rwAcc[level]) rwAcc[level] = score;
      }
    });
  }

  // 4. Process Submissions (Tests) - Update Accuracies and Track Scaled Highs + LATEST
  if (Array.isArray(submissionsData)) {
    submissionsData.forEach(sub => {
      const cat = getCategory(sub);
      const level = sub.level ? sub.level.charAt(0).toUpperCase() + sub.level.slice(1).toLowerCase() : 'Medium';
      const testDate = new Date(sub.test_date || sub.created_at).getTime();
      
      // Update accuracies from raw percentage
      const rawPct = Math.round(sub.raw_score_percentage || 0);
      if (cat === 'MATH') {
        if (rawPct > mathAcc[level]) mathAcc[level] = rawPct;
      } else {
        if (rawPct > rwAcc[level]) rwAcc[level] = rawPct;
      }

      // Identify section values
      // 1. Prioritize explicit section fields if they exist (> 0)
      // 2. Cross-calculate if it is a combined test (scaled_score > 800)
      // 3. Fallback to total scaled_score ONLY if matching category AND it is a section test (<= 800)
      let mathVal = sub.math_scaled_score || 0;
      let rwVal = (sub.reading_scaled_score || 0) + (sub.writing_scaled_score || 0);

      // Handle combined full tests (typically > 800)
      if (sub.scaled_score > 800) {
        if (!mathVal && rwVal) mathVal = sub.scaled_score - rwVal;
        if (!rwVal && mathVal) rwVal = sub.scaled_score - mathVal;
      } 
      // Handle fallback for section-only tests (typically <= 800)
      else if (sub.scaled_score > 0 && sub.scaled_score <= 800) {
        if (!mathVal && !rwVal) {
          if (cat === 'MATH') mathVal = sub.scaled_score;
          else rwVal = sub.scaled_score;
        }
      }

      // Track BEST
      if (mathVal > maxMathTest) maxMathTest = mathVal;
      if (rwVal > maxRWTest) maxRWTest = rwVal;

      // Track LATEST
      if (mathVal > 0 && testDate > latestMathDate) {
        latestMathDate = testDate;
        latestMathTest = mathVal;
      }
      if (rwVal > 0 && testDate > latestRWDate) {
        latestRWDate = testDate;
        latestRWTest = rwVal;
      }
    });
  }

  // 5. Calculate Weighted Section Scores (Estimated Bases)
  const weightedMathAcc = (mathAcc.Easy * 0.2 + mathAcc.Medium * 0.35 + mathAcc.Hard * 0.45);
  const weightedRWAcc = (rwAcc.Easy * 0.2 + rwAcc.Medium * 0.35 + rwAcc.Hard * 0.45);

  let bestMath = Math.max(200, Math.round(200 + (weightedMathAcc * 6)));
  let bestRW = Math.max(200, Math.round(200 + (weightedRWAcc * 6)));

  // 6. Incorporate best actual tests
  if (maxMathTest > bestMath) bestMath = maxMathTest;
  if (maxRWTest > bestRW) bestRW = maxRWTest;

  // 7. Establish Historical Baselines (Floors) from Diagnostic
  const baselineMath = diagnosticData ? (parseInt(diagnosticData.mathScore) || 200) : 200;
  const baselineRW = diagnosticData ? (parseInt(diagnosticData.rwScore) || 200) : 200;

  const mathFloor = !isNaN(baselineMath) ? Math.min(800, baselineMath) : 200;
  const rwFloor = !isNaN(baselineRW) ? Math.min(800, baselineRW) : 200;

  if (bestMath < mathFloor) bestMath = mathFloor;
  if (bestRW < rwFloor) bestRW = rwFloor;

  // 8. FINAL SCORE SELECTION (PRIORITIZE LATEST TEST IF EXISTS)
  // Per user request: "dashboard should display the latest scores for both Math and English from the most recent test attempt"
  let displayMath = latestMathTest > 0 ? latestMathTest : bestMath;
  let displayRW = latestRWTest > 0 ? latestRWTest : bestRW;

  // Sanity check
  displayMath = Math.min(800, Math.max(200, displayMath));
  displayRW = Math.min(800, Math.max(200, displayRW));

  const total = displayMath + displayRW;

  return {
    current: total,
    math: displayMath,
    rw: displayRW,
    bestMath: Math.min(800, bestMath),
    bestRW: Math.min(800, bestRW),
    latestMath: latestMathTest,
    latestRW: latestRWTest,
    target: target,
    gap: Math.max(0, target - total),
    mathImprovement: Math.max(0, displayMath - mathFloor),
    rwImprovement: Math.max(0, displayRW - rwFloor),
    isMathMaxed: displayMath >= 800,
    isRWMaxed: displayRW >= 800
  };
};