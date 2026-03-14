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

  // RW Keywords - CHECK THESE FIRST
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

  // Calculate scores based on the specific level accuracy
  // Rule: We take the BEST single level performance as the section score
  // instead of a weighted mix that "inflates" the score.
  
  const calcMath = Math.max(
    calculateSessionScore('MATH', 'Easy', mathAcc.Easy),
    calculateSessionScore('MATH', 'Medium', mathAcc.Medium),
    calculateSessionScore('MATH', 'Hard', mathAcc.Hard)
  );

  const calcRW = Math.max(
    calculateSessionScore('RW', 'Easy', rwAcc.Easy),
    calculateSessionScore('RW', 'Medium', rwAcc.Medium),
    calculateSessionScore('RW', 'Hard', rwAcc.Hard)
  );

  const bestMath = Math.max(200, calcMath);
  const bestRW = Math.max(200, calcRW);

  return {
    math: bestMath,
    rw: bestRW,
    total: bestMath + bestRW
  };
};
