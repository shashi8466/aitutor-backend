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
  // FINAL REQUIREMENT: SAT-Style Score Calculation (Apply Across Entire Application)
  // ⚖️ Weighted Model: Easy 20%, Medium 35%, Hard 45%
  // 🧮 Final Score Formula: ((E*0.20 + M*0.35 + H*0.45) / 100) * 800
  
  const e = Number(easy) || 0;
  const m = Number(medium) || 0;
  const h = Number(hard) || 0;

  const weightedAccuracy = (e * 0.20) + (m * 0.35) + (h * 0.45); // 0–100 range
  
  // Apply the 800-point scale mapping specifically requested by user
  const finalScore = (weightedAccuracy / 100) * 800;

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
  let latestAdaptiveMath = 0;
  let latestAdaptiveRW = 0;

  if (Array.isArray(submissionsData)) {
    // Sort by date to get the LATEST adaptive scores
    const sortedSubs = [...submissionsData].sort((a, b) => new Date(b.test_date || b.created_at) - new Date(a.test_date || a.created_at));
    
    sortedSubs.forEach(sub => {
      if (sub.level === 'Adaptive') {
        if (!latestAdaptiveMath && sub.math_scaled_score) latestAdaptiveMath = sub.math_scaled_score;
        if (!latestAdaptiveRW && sub.reading_scaled_score) latestAdaptiveRW = sub.reading_scaled_score;
      }
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

  // 5. Final section scores for dashboards: prioritize LATEST Adaptive score if available, 
  // otherwise fallback to pure weighted SAT-style scores.
  const displayMath = latestAdaptiveMath || Math.min(800, Math.max(0, satMath));
  const displayRW = latestAdaptiveRW || Math.min(800, Math.max(0, satRW));

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
