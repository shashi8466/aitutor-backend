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
  // 1. Establish Baselines
  let baseMath = 400;
  let baseRW = 400;
  let target = 1500;

  if (diagnosticData) {
    baseMath = parseInt(diagnosticData.mathScore) || 400;
    baseRW = parseInt(diagnosticData.rwScore) || 400;
    target = parseInt(diagnosticData.targetScore) || 1500;
  }

  let bestMath = baseMath;
  let bestRW = baseRW;

  // 2. Helper to get category
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

  // 5. Capping (Just in case)
  bestMath = Math.min(800, bestMath);
  bestRW = Math.min(800, bestRW);
  const total = bestMath + bestRW;

  return {
    current: total,
    math: bestMath,
    rw: bestRW,
    target: target,
    gap: Math.max(0, target - total),
    mathImprovement: Math.max(0, bestMath - baseMath),
    rwImprovement: Math.max(0, bestRW - baseRW),
    isMathMaxed: bestMath >= 800,
    isRWMaxed: bestRW >= 800
  };
};