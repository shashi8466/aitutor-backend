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
  const type = (item.courses?.tutor_type || '').toLowerCase();
  const name = (item.courses?.name || '').toLowerCase();

  if (type.includes('math') || type.includes('quant') || name.includes('math') || name.includes('algebra')) return 'MATH';
  if (type.includes('reading') || type.includes('writing') || name.includes('english')) return 'RW';
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

export const calculateStudentScore = (progressData, diagnosticData) => {
  // 1. Establish Goals
  let target = 1500;
  if (diagnosticData && diagnosticData.targetScore) {
    target = parseInt(diagnosticData.targetScore) || 1500;
  }

  // 2. Initialize Accuracies
  const mathAcc = { Easy: 0, Medium: 0, Hard: 0 };
  const rwAcc = { Easy: 0, Medium: 0, Hard: 0 };

  // 3. Process Progress to find BEST demonstrated performance per level
  if (Array.isArray(progressData) && progressData.length > 0) {
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

  // 4. Calculate Weighted Section Scores
  // Formula: 200 + (WeightedAccuracy * 6)
  // WeightedAccuracy = (Easy * 0.2 + Medium * 0.35 + Hard * 0.45)
  // SAT Floor: 200, Max: 800
  const weightedMathAcc = (mathAcc.Easy * 0.2 + mathAcc.Medium * 0.35 + mathAcc.Hard * 0.45);
  const weightedRWAcc = (rwAcc.Easy * 0.2 + rwAcc.Medium * 0.35 + rwAcc.Hard * 0.45);

  let bestMath = Math.max(200, Math.round(200 + (weightedMathAcc * 6)));
  let bestRW = Math.max(200, Math.round(200 + (weightedRWAcc * 6)));

  // 5. Establish Historical Baselines (Floors) from Diagnostic
  const baselineMath = diagnosticData ? (parseInt(diagnosticData.mathScore) || 200) : 200;
  const baselineRW = diagnosticData ? (parseInt(diagnosticData.rwScore) || 200) : 200;

  const mathFloor = !isNaN(baselineMath) ? Math.min(800, baselineMath) : 200;
  const rwFloor = !isNaN(baselineRW) ? Math.min(800, baselineRW) : 200;

  if (bestMath < mathFloor) bestMath = mathFloor;
  if (bestRW < rwFloor) bestRW = rwFloor;

  const total = bestMath + bestRW;

  return {
    current: total,
    math: bestMath,
    rw: bestRW,
    target: target,
    gap: Math.max(0, target - total),
    mathImprovement: Math.max(0, bestMath - mathFloor),
    rwImprovement: Math.max(0, bestRW - rwFloor),
    isMathMaxed: bestMath >= 800,
    isRWMaxed: bestRW >= 800
  };
};