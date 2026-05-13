// SAT SCORING CONSTANTS (Matches Frontend)
export const SCORING_CONFIG = {
  MATH: {
    QUESTIONS: 22,
    LEVELS: {
      'Easy': { min: 200, max: 500 },
      'Medium': { min: 200, max: 650 },
      'Hard': { min: 200, max: 800 }
    }
  },
  RW: {
    QUESTIONS: 27,
    LEVELS: {
      'Easy': { min: 200, max: 500 },
      'Medium': { min: 200, max: 650 },
      'Hard': { min: 200, max: 800 }
    }
  }
};

export const getCategory = (courseName, tutorType) => {
  const type = (tutorType || '').toLowerCase();
  const name = (courseName || '').toLowerCase();

  // Math Keywords (Highly Specific)
  const mathKeywords = [
    'math', 'quant', 'algebra', 'geometry', 'calc', 'trig', 'functions', 'linear', 
    'equations', 'expressions', 'ratios', 'percentages', 'probability', 'statistics',
    'inference', 'area', 'volume', 'triangles', 'circles', 'number', 'operations',
    'inequalities', 'systems', 'nonlinear', 'modeling', 'data analysis'
  ];

  if (mathKeywords.some(kw => type.includes(kw) || name.includes(kw))) {
    return 'MATH';
  }

  // RW Keywords (Comprehensive)
  const rwKeywords = [
    'reading', 'writing', 'verbal', 'rw', 'english', 'grammar', 'r & d', 'r&d', 
    'literacy', 'evidence', 'expression', 'ideas', 'structure', 'context', 
    'synthesis', 'rhetorical', 'conventions'
  ];

  if (rwKeywords.some(kw => type.includes(kw) || name.includes(kw))) {
    return 'RW';
  }

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
  // We strictly use TEST submissions for the leaderboard to ensure "Real" scores
  // Note: progressEntries passed here currently come from student_progress table 
  // but for the true "Test" leaderboard, we should be using the most recent 
  // actual test records.

  // If the entries are from student_progress, we still sum them but without 
  // the weighted 'invented' estimate.
  
  const mathAcc = { Easy: 0, Medium: 0, Hard: 0 };
  const rwAcc = { Easy: 0, Medium: 0, Hard: 0 };

  progressEntries.forEach(p => {
    const cat = getCategory(p.courses?.name || p.name, p.courses?.tutor_type || p.tutor_type);
    const level = p.level ? p.level.charAt(0).toUpperCase() + p.level.slice(1).toLowerCase() : 'Medium';
    const score = p.score || 0;

    if (cat === 'MATH') {
      if (score > mathAcc[level]) mathAcc[level] = score;
    } else {
      if (score > rwAcc[level]) rwAcc[level] = score;
    }
  });

  // Calculate SAT-style section scores using weighted average across levels
  // This matches the frontend calculateSatScore() function
  const calcMath = calculateSatScore(mathAcc.Easy, mathAcc.Medium, mathAcc.Hard);
  const calcRW = calculateSatScore(rwAcc.Easy, rwAcc.Medium, rwAcc.Hard);

  const bestMath = Math.max(0, calcMath);
  const bestRW = Math.max(0, calcRW);

  return {
    math: bestMath,
    rw: bestRW,
    total: bestMath + bestRW
  };
};

// SAT-style scoring model - Linear mapping from 200 to 800 based on peak accuracy
export const calculateSatScore = (easy, medium, hard) => {
  // Use the maximum accuracy achieved across any level to represent the section's current peak
  const maxAccuracy = Math.max(Number(easy) || 0, Number(medium) || 0, Number(hard) || 0);
  
  // Apply the standard linear 200-800 scale mapping (matching TestReview page)
  const finalScore = 200 + (maxAccuracy / 100) * 600;
  
  // Enforce section bounds [200, 800]
  return Math.min(800, Math.max(200, Math.round(finalScore)));
};
