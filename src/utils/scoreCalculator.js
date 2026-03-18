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
  // SAT-style weighted model across levels:
  // Easy 20%, Medium 35%, Hard 45%, then mapped to SAT 200–800.
  const e = Number(easy) || 0;
  const m = Number(medium) || 0;
  const h = Number(hard) || 0;

  const weightedAccuracy = (e * 0.20) + (m * 0.35) + (h * 0.45); // 0–100 range
  // Map 0–100 → 200–800 (200 floor, 800 ceiling)
  const rawScore = 200 + (weightedAccuracy / 100) * 600;

  // Clamp defensively to valid SAT section bounds
  const finalScore = Math.min(800, Math.max(200, rawScore));
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

  // 3. Aggregate BEST accuracy per level (Easy/Medium/Hard) across all courses
  // for each category (MATH, RW). This powers the weighted SAT formula.
  const levelAccuracies = {
    MATH: { Easy: 0, Medium: 0, Hard: 0 },
    RW: { Easy: 0, Medium: 0, Hard: 0 }
  };

  const updateLevelAccuracy = (item, rawPercentage) => {
    const cat = getCategory(item);
    const levelRaw = item.level || 'Medium';
    const level = levelRaw.charAt(0).toUpperCase() + levelRaw.slice(1).toLowerCase();
    if (!['Easy', 'Medium', 'Hard'].includes(level)) return;
    const pct = Math.round(rawPercentage || 0);
    if (pct > levelAccuracies[cat][level]) {
      levelAccuracies[cat][level] = pct;
    }
  };

  // A. From submissions (authoritative test data)
  if (Array.isArray(submissionsData)) {
    submissionsData.forEach(sub => {
      updateLevelAccuracy(sub, sub.raw_score_percentage);
    });
  }

  // B. From progress table (fallback / supplement)
  if (Array.isArray(progressData)) {
    progressData.forEach(p => {
      if (typeof p.score === 'number') {
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
    : baselineMath;

  const satRW = hasRWLevels
    ? calculateSatScore(rwLevels.Easy, rwLevels.Medium, rwLevels.Hard)
    : baselineRW;

  // 5. Final section scores for dashboards: pure weighted SAT-style scores
  // based on Easy/Medium/Hard performance (or diagnostic baselines).
  const displayMath = Math.min(800, Math.max(200, satMath));
  const displayRW = Math.min(800, Math.max(200, satRW));

  const total = displayMath + displayRW;
  const baselineTotal = baselineMath + baselineRW;

  return {
    current: total,
    math: displayMath,
    rw: displayRW,
    // For now, best/latest are the same weighted scores (can be extended later)
    weightedMath: displayMath,
    weightedRW: displayRW,
    bestMath: displayMath,
    bestRW: displayRW,
    latestMath: displayMath,
    latestRW: displayRW,
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