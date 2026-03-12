// SAT SCORING CONSTANTS (Matches Frontend)
export const SCORING_CONFIG = {
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

export const getCategory = (courseName, tutorType) => {
  const type = (tutorType || '').toLowerCase();
  const name = (courseName || '').toLowerCase();

  if (type.includes('math') || type.includes('quant') || name.includes('math') || name.includes('algebra')) return 'MATH';
  if (type.includes('reading') || type.includes('writing') || name.includes('english')) return 'RW';
  return 'RW'; // Default fallback
};

export const calculateSessionScore = (category, levelName, percentageScore) => {
  const config = SCORING_CONFIG[category];
  const normalizedLevel = levelName ? levelName.charAt(0).toUpperCase() + levelName.slice(1).toLowerCase() : 'Medium';
  const levelStats = config.LEVELS[normalizedLevel] || config.LEVELS['Medium'];

  const ratio = (percentageScore || 0) / 100;
  const levelMax = levelStats.max;
  const levelMin = levelStats.min;

  // Formula: Level_Min + (Correct_Ratio * (Level_Max - Level_Min))
  // This calculates the score within the specific level range based on accuracy
  const finalScore = levelMin + (ratio * (levelMax - levelMin));

  return Math.round(finalScore);
};

export const calculateTotalSATScore = (progressEntries) => {
  const mathAcc = { Easy: 0, Medium: 0, Hard: 0 };
  const rwAcc = { Easy: 0, Medium: 0, Hard: 0 };

  progressEntries.forEach(p => {
    const cat = getCategory(p.courses?.name, p.courses?.tutor_type);
    const level = p.level ? p.level.charAt(0).toUpperCase() + p.level.slice(1).toLowerCase() : 'Medium';
    const score = p.score || 0;

    if (cat === 'MATH') {
      if (score > mathAcc[level]) mathAcc[level] = score;
    } else {
      if (score > rwAcc[level]) rwAcc[level] = score;
    }
  });

  // Calculate Weighted Section Scores
  // Formula: 200 + (WeightedAccuracy * 6)
  // WeightedAccuracy = (Easy * 0.2 + Medium * 0.35 + Hard * 0.45)
  // SAT Floor: 200, Max: 800
  const weightedMathAcc = (mathAcc.Easy * 0.2 + mathAcc.Medium * 0.35 + mathAcc.Hard * 0.45);
  const weightedRWAcc = (rwAcc.Easy * 0.2 + rwAcc.Medium * 0.35 + rwAcc.Hard * 0.45);

  const bestMath = Math.max(200, Math.round(200 + (weightedMathAcc * 6)));
  const bestRW = Math.max(200, Math.round(200 + (weightedRWAcc * 6)));

  return {
    math: bestMath,
    rw: bestRW,
    total: bestMath + bestRW
  };
};
