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

export const calculateStudentScore = (progressData, diagnosticData) => {
  // 1. Establish Goals
  let target = 1500;
  if (diagnosticData && diagnosticData.targetScore) {
    target = parseInt(diagnosticData.targetScore) || 1500;
  }

  // 2. Initialize Section Scores with SAT Minimums (200)
  // These will grow based on actual performance (progressData)
  let bestMath = 200;
  let bestRW = 200;

  // 3. Establish Historical Baselines (Floors) from Diagnostic
  // Defensively parse and cap at 800 to prevent corrupted strings
  const baselineMath = diagnosticData ? (parseInt(diagnosticData.mathScore) || 200) : 200;
  const baselineRW = diagnosticData ? (parseInt(diagnosticData.rwScore) || 200) : 200;
  const getCategory = (item) => {
    const type = (item.courses?.tutor_type || '').toLowerCase();
    const name = (item.courses?.name || '').toLowerCase();

    if (type.includes('math') || type.includes('quant') || name.includes('math') || name.includes('algebra')) return 'MATH';
    if (type.includes('reading') || type.includes('writing') || name.includes('english')) return 'RW';
    return 'RW'; // Default fallback
  };

  // 3. Helper: The Core User Formula Implementation
  const calculateSessionScore = (category, levelName, percentageScore) => {
    const config = SCORING_CONFIG[category];
    // Default to Medium if unknown level
    const levelStats = config.LEVELS[levelName] || config.LEVELS['Medium'];

    const ratio = (percentageScore || 0) / 100;
    const levelMax = levelStats.max;
    const levelMin = levelStats.min;

    // Direct mapping to the level's score range
    // Formula: Level_Min + (Correct_Ratio * (Level_Max - Level_Min))
    const finalScore = levelMin + (ratio * (levelMax - levelMin));

    return Math.round(finalScore);
  };

  // 4. Process Progress to find BEST demonstrated performance
  if (Array.isArray(progressData) && progressData.length > 0) {
    progressData.forEach(item => {
      const cat = getCategory(item);
      // Ensure level string matches keys (Capitalized)
      const level = item.level ? item.level.charAt(0).toUpperCase() + item.level.slice(1).toLowerCase() : 'Medium';

      const score = calculateSessionScore(cat, level, item.score);

      if (cat === 'MATH') {
        if (score > bestMath) bestMath = score;
      } else {
        if (score > bestRW) bestRW = score;
      }
    });
  }

  // 5. Apply Sane Section Floors
  // If performance-based score is less than baseline, use baseline (but cap baseline at 800)
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