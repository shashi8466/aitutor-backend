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
      'Easy': { min: 200, max: 500 },
      'Medium': { min: 400, max: 650 },
      'Hard': { min: 550, max: 800 }
    }
  }
};

export const getCategory = (item) => {
  if (!item) return 'RW';

  // Handle both flat objects and nested course(s) objects
  const type = (item.tutor_type || item.courses?.tutor_type || item.course?.tutor_type || '').toLowerCase();
  const name = (item.name || item.courses?.name || item.course?.name || item.course_name || '').toLowerCase();

  // Math Keywords (Highly Specific) - Checked FIRST
  const mathKeywords = [
    'linear', 'functions', 'math', 'quant', 'algebra', 'geometry', 'calc', 'trig', 
    'equations', 'expressions', 'ratios', 'percentages', 'probability', 'statistics',
    'inference', 'area', 'volume', 'triangles', 'circles', 'number', 'operations',
    'inequalities', 'systems', 'nonlinear', 'modeling', 'data analysis'
  ];

  if (mathKeywords.some(kw => type.includes(kw) || name.includes(kw))) {
    return 'MATH';
  }

  // RW Keywords (Added 'r & d', 'verbal', 'literacy', 'evidence', 'expression')
  const rwKeywords = [
    'reading', 'writing', 'verbal', 'rw', 'english', 'grammar', 'r & d', 'r&d', 
    'literacy', 'evidence', 'expression', 'ideas', 'structure', 'context', 
    'synthesis', 'rhetorical', 'conventions'
  ];

  if (rwKeywords.some(kw => type.includes(kw) || name.includes(kw))) {
    return 'RW';
  }

  // Fallback check: if it contains 'test' or 'exam' but no math keywords, it's likely RW or mixed
  if (name.includes('test') || name.includes('exam') || type.includes('test')) {
    // If it's a full length test, it could be both, but we usually default to RW if unspecified
    // However, adaptive tests are handled separately in the calculator
    return 'RW';
  }

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
  // Use the maximum accuracy achieved across any level to represent the section's current peak
  const maxAccuracy = Math.max(Number(easy) || 0, Number(medium) || 0, Number(hard) || 0);
  
  // Apply the standard linear 200-800 scale mapping
  // This ensures that 4% accuracy = 224, 100% = 800, etc.
  const finalScore = 200 + (maxAccuracy / 100) * 600;
  
  return Math.round(finalScore);
};

export const calculateStudentScore = (progressData, diagnosticData, submissionsData = []) => {
  // 1. Establish Goals
  let target = 1500;
  if (diagnosticData && diagnosticData.targetScore) {
    target = parseInt(diagnosticData.targetScore) || 1500;
  }

  // 2. Identify Section Baselines (From Diagnostics)
  const baselineMath = diagnosticData ? (parseInt(diagnosticData.mathScore) || 0) : 0;
  const baselineRW = diagnosticData ? (parseInt(diagnosticData.rwScore) || 0) : 0;

  // 3. Aggregate BEST accuracy per level (Easy/Medium/Hard) across all courses
  const levelAccuracies = {
    MATH: { Easy: 0, Medium: 0, Hard: 0 },
    RW: { Easy: 0, Medium: 0, Hard: 0 }
  };

  let hasMathAttempts = baselineMath > 0;
  let hasRWAttempts = baselineRW > 0;

  const updateLevelAccuracy = (item, rawPercentage) => {
    const cat = getCategory(item);
    const levelRaw = item.level || 'Medium';
    const level = levelRaw.charAt(0).toUpperCase() + levelRaw.slice(1).toLowerCase();
    
    if (!['Easy', 'Medium', 'Hard'].includes(level)) return;
    
    const pct = Math.round(rawPercentage || 0);
    if (pct > 0) {
      if (cat === 'MATH') hasMathAttempts = true;
      else if (cat === 'RW') hasRWAttempts = true;
    }

    if (pct > levelAccuracies[cat][level]) {
      levelAccuracies[cat][level] = pct;
    }
  };

  // A. From submissions (authoritative test data)
  let bestAdaptiveMath = 0;
  let bestAdaptiveRW = 0;

  if (Array.isArray(submissionsData)) {
    submissionsData.forEach(sub => {
      const cat = getCategory(sub);
      
      const hasMathVal = (cat === 'MATH' && (sub.raw_score_percentage > 0 || sub.math_scaled_score > 200)) || sub.math_scaled_score > 200;
      const hasRWVal = (cat === 'RW' && (sub.raw_score_percentage > 0 || sub.reading_scaled_score > 200)) || sub.reading_scaled_score > 200;

      if (hasMathVal) hasMathAttempts = true;
      if (hasRWVal) hasRWAttempts = true;

      // Find highest adaptive scores across ALL tests (Superscore style)
      if (sub.level === 'Adaptive') {
        if (sub.math_scaled_score > bestAdaptiveMath) bestAdaptiveMath = sub.math_scaled_score;
        if (sub.reading_scaled_score > bestAdaptiveRW) bestAdaptiveRW = sub.reading_scaled_score;
      }
      updateLevelAccuracy(sub, sub.raw_score_percentage);
    });
  }

  // B. From progress table (fallback / supplement)
  if (Array.isArray(progressData)) {
    progressData.forEach(p => {
      if (typeof p.score === 'number' && p.score > 0) {
        const cat = getCategory(p);
        if (cat === 'MATH') hasMathAttempts = true;
        if (cat === 'RW') hasRWAttempts = true;
        updateLevelAccuracy(p, p.score);
      }
    });
  }

  // 4. Compute SAT-style section scores from aggregated level accuracies
  const mathLevels = levelAccuracies.MATH;
  const rwLevels = levelAccuracies.RW;

  const hasMathLevels = mathLevels.Easy > 0 || mathLevels.Medium > 0 || mathLevels.Hard > 0;
  const hasRWLevels = rwLevels.Easy > 0 || rwLevels.Medium > 0 || rwLevels.Hard > 0;

  const satMath = hasMathLevels
    ? calculateSatScore(mathLevels.Easy, mathLevels.Medium, mathLevels.Hard)
    : (hasMathAttempts ? baselineMath : 200);

  const satRW = hasRWLevels
    ? calculateSatScore(rwLevels.Easy, rwLevels.Medium, rwLevels.Hard)
    : (hasRWAttempts ? baselineRW : 200);

  // 5. Final section scores for dashboards: prioritize BEST (Highest) score achieved.
  // Fallback to pure weighted SAT-style scores if no adaptive scores exist.
  // Apply Minimum Fallbacks: RW=200, Math=200, Total=400
  let displayMath = bestAdaptiveMath || satMath;
  let displayRW = bestAdaptiveRW || satRW;

  // Enforce Minimums Strictly
  if (displayMath < 200) displayMath = 200;
  if (displayRW < 200) displayRW = 200;

  // If NO attempts at all in a section, force it to 200 (Don't let diagnostics or weighted scores override)
  if (!hasMathAttempts) displayMath = 200;
  if (!hasRWAttempts) displayRW = 200;

  const total = displayMath + displayRW;
  const baselineTotal = (baselineMath || 200) + (baselineRW || 200);

  return {
    current: total,
    math: displayMath,
    rw: displayRW,
    bestMath: displayMath,
    bestRW: displayRW,
    latestMath: displayMath,
    latestRW: displayRW,
    target: target,
    gap: Math.max(0, target - total),
    baselineTotal: baselineTotal,
    totalImprovement: Math.max(0, total - baselineTotal),
    mathImprovement: Math.max(0, displayMath - (baselineMath || 200)),
    rwImprovement: Math.max(0, displayRW - (baselineRW || 200)),
    isMathMaxed: displayMath >= 800,
    isRWMaxed: displayRW >= 800
  };
};
