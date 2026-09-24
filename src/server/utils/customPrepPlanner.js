/**
 * Custom Prep / Prepare More — pure planning logic (no DB access here).
 *
 * Deliberately rule-based rather than AI/LLM-generated: the whole point of this feature is that
 * the plan is a direct, explainable function of the student's OWN Full-Length Test performance
 * (per-topic accuracy) plus their stated constraints (target score, hours/day, number of days) -
 * not a generic template and not something that could quietly hallucinate a topic the student
 * never actually got wrong. Every function here is pure and independently testable.
 */

// Recommended target-score band by current score, anchored to the explicit table product gave
// (1100->1300-1350, 1200->1400-1450, 1300->1450-1500, 1400->1500-1550, 1500->1550) and linearly
// interpolated/extrapolated between/around those points, clamped to the 400-1600 SAT scale. The
// gap between current and recommended shrinks at higher scores (less realistic headroom near the
// ceiling) - the anchors below 1100 continue that same shrinking-gap shape downward.
const TARGET_ANCHORS = [
  { score: 400, min: 650, max: 700 },
  { score: 600, min: 850, max: 900 },
  { score: 800, min: 1050, max: 1100 },
  { score: 1000, min: 1250, max: 1300 },
  { score: 1100, min: 1300, max: 1350 },
  { score: 1200, min: 1400, max: 1450 },
  { score: 1300, min: 1450, max: 1500 },
  { score: 1400, min: 1500, max: 1550 },
  { score: 1500, min: 1550, max: 1580 },
  { score: 1600, min: 1600, max: 1600 }
];

export function getRecommendedTargetRange(currentScore) {
  const score = Math.max(400, Math.min(1600, Math.round(currentScore || 400)));
  const roundTo10 = (n) => Math.min(1600, Math.round(n / 10) * 10);

  for (let i = 0; i < TARGET_ANCHORS.length - 1; i++) {
    const a = TARGET_ANCHORS[i];
    const b = TARGET_ANCHORS[i + 1];
    if (score >= a.score && score <= b.score) {
      const t = b.score === a.score ? 0 : (score - a.score) / (b.score - a.score);
      return {
        min: roundTo10(a.min + t * (b.min - a.min)),
        max: roundTo10(a.max + t * (b.max - a.max))
      };
    }
  }
  const last = TARGET_ANCHORS[TARGET_ANCHORS.length - 1];
  return { min: last.min, max: last.max };
}

// Honest difficulty framing for a student-CHOSEN target (which may be well above the recommended
// band) - never used to promise an outcome, only to set expectations about how ambitious the
// combination of target + available study time actually is. assumedPointsPerHour is a clearly
// rough, documented heuristic for this classification only - it is never surfaced as a guarantee.
export function classifyDifficulty({ currentScore, targetScore, totalHours }) {
  const pointsGap = Math.max(0, targetScore - currentScore);
  if (targetScore <= currentScore) {
    return { label: 'Target Already Reached', pointsGap: 0, projectedGainHint: 0 };
  }
  const assumedPointsPerHour = 8;
  const projectedGainHint = Math.round(totalHours * assumedPointsPerHour);
  let label;
  if (projectedGainHint >= pointsGap * 1.2) label = 'Achievable';
  else if (projectedGainHint >= pointsGap * 0.6) label = 'Ambitious';
  else label = 'Highly Ambitious';
  return { label, pointsGap, projectedGainHint };
}

const clampMinutes = (m) => Math.max(0, Math.round(m));

// Locked, non-overlapping boundaries - every accuracy value from 0-100 maps to exactly one level.
// This is the core of Custom Prep: the ORIGINAL Full-Length Test's per-topic accuracy decides
// WHAT LEVEL the student studies (Easy/Medium/Hard course content), never the available time -
// time only decides the schedule (see buildDayByDayPlan below). A topic above 80% accuracy is not
// a priority weakness at all - see isPriorityWeakness, the single gate every caller (the Setup
// screen's priority list AND the day-by-day generator) uses to decide what's even in scope.
export function getRecommendedLevel(accuracy) {
  if (accuracy == null) return 'Medium';
  const a = Math.max(0, Math.min(100, accuracy));
  if (a <= 30) return 'Easy';
  if (a <= 54) return 'Medium';
  if (a <= 80) return 'Hard';
  return 'Maintenance';
}

// A topic only counts as a Custom Prep priority weakness at 80% accuracy or below - above that,
// the student doesn't need remediation on it, so it's excluded from the priority list and the
// generated schedule entirely rather than being force-included as a low-weight "Maintenance" item.
export function isPriorityWeakness(accuracy) {
  return accuracy != null && accuracy <= 80;
}

// First/Second/Third Priority is the same Easy/Medium/Hard classification above, just the label
// the Setup screen groups topics under.
export const PRIORITY_TIER_LABEL = { Easy: 'First Priority', Medium: 'Second Priority', Hard: 'Third Priority' };

// The real course-level content only has Easy/Medium/Hard (see LevelDashboard/QuizDispatcher
// routes). A Maintenance-range topic (81-100%) is no longer a priority weakness at all (see
// isPriorityWeakness) and is excluded before reaching here in normal use - this mapping to
// Hard-level content only matters as a defensive fallback if this function is ever called
// directly on one.
export function routingLevelFor(recommendedLevel) {
  return recommendedLevel === 'Maintenance' ? 'Hard' : recommendedLevel;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHOLE-PLAN WORKLOAD FIRST, THEN DAILY SCHEDULING
//
// The old approach computed each day's topic durations independently, from that ONE day's topic
// count and daily cap alone - which is mathematically indistinguishable from
// `dailyMinutes / topicsToday` whenever a day's topics happen to share a tier (the exact "every
// topic = 45 min" bug this replaces). The correct order is:
//   1. Total available minutes across the WHOLE plan (capMinutesPerDay * regularDayCount).
//   2. How much of that total each qualifying topic should get overall (buildTopicBudgets) -
//      driven by priority tier AND by accuracy WITHIN that tier (a 12% topic outweighs a 28%
//      topic even though both are First Priority/Easy).
//   3. Break each topic's total into an ordered Study -> Targeted Practice -> Review Incorrect ->
//      Reassessment pass sequence (buildTopicPasses) - never one lump sum on one day.
//   4. Spread those passes across the plan's days (scheduleDays), at most one pass per topic per
//      day so a topic's own passes land on DIFFERENT days, and never exceeding the daily cap.
// ─────────────────────────────────────────────────────────────────────────────────────────────

// Configurable in one place - not hard-coded per call site. How much of the TOTAL plan workload a
// topic's tier is entitled to before accuracy fine-tunes it further within that tier.
const PRIORITY_TOTAL_WEIGHT = { Easy: 1.6, Medium: 1.15, Hard: 0.85, Maintenance: 0.85 };

const STEP = 5;
// Floor for a single Study/Targeted-Practice/Review/Reassessment block - below this a pass stops
// being a meaningful activity (the "never 1-4 minutes unless genuinely required" rule).
const MIN_PASS_MINUTES = 15;
// Smallest whole-plan total any qualifying topic can receive - enough for at least one Study +
// Targeted Practice pass, even on a very tight plan.
const MIN_TOPIC_TOTAL_MINUTES = 20;

// A topic's weight combines its priority tier AND how weak it specifically is within that tier -
// used both to size its whole-plan budget (buildTopicBudgets) and to decide which topic gets the
// next available slot when several are competing for the same day (scheduleDays).
function computeTopicWeight(t) {
  const tierWeight = PRIORITY_TOTAL_WEIGHT[t.recommendedLevel] || 1;
  const accuracy = t.accuracy == null ? 50 : Math.max(0, Math.min(100, t.accuracy));
  const accuracyFactor = 1 - accuracy / 100; // 0% accuracy -> 1.0, 80% accuracy -> 0.2
  return tierWeight * Math.max(0.2, accuracyFactor);
}

/**
 * How many TOTAL minutes each qualifying topic should receive across the ENTIRE plan - the
 * question the old per-day approach never asked. Proportional to computeTopicWeight, rounded to a
 * clean 5-minute total and floored at MIN_TOPIC_TOTAL_MINUTES. If the floor pushes the combined
 * total above what the plan can actually hold (many topics, few days), everyone is scaled back
 * down proportionally - coverage of every topic matters more than any one topic's ideal depth.
 */
function buildTopicBudgets(topics, totalWorkloadMinutes) {
  if (topics.length === 0) return [];
  const weights = topics.map(computeTopicWeight);
  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;

  // Flooring EVERY topic at MIN_TOPIC_TOTAL_MINUTES only makes sense if the plan can actually
  // afford that floor for everyone - otherwise it washes out all weight differentiation (every
  // topic force-floored to the same value, then scaled down by the same factor, ends up with the
  // exact same final budget regardless of priority/accuracy - a flat-duration bug just like the
  // one this whole rewrite exists to fix, just one level up). When the comfortable floor doesn't
  // fit, drop straight to a small-floor (STEP) proportional split instead, so weaker/higher-
  // priority topics still get more than stronger ones even under real time pressure.
  const comfortableFloorFits = topics.length * MIN_TOPIC_TOTAL_MINUTES <= totalWorkloadMinutes;
  const floor = comfortableFloorFits ? MIN_TOPIC_TOTAL_MINUTES : STEP;

  let totals = topics.map((_, i) =>
    Math.max(floor, Math.round((totalWorkloadMinutes * weights[i]) / totalWeight / STEP) * STEP)
  );

  const sum = totals.reduce((s, m) => s + m, 0);
  if (sum > totalWorkloadMinutes && totalWorkloadMinutes > 0) {
    // Floor at STEP here, NOT MIN_PASS_MINUTES - re-imposing the normal per-pass floor after
    // scaling down would just reintroduce the same oversubscription the scaling was meant to fix
    // (many topics all re-floored back up to 15 can still out-total the plan). A genuinely tight
    // plan (many topics, little time) means some topics only afford a short first touch - matches
    // the explicit "a block can go small when the remaining plan genuinely requires it" allowance.
    const scale = totalWorkloadMinutes / sum;
    totals = totals.map((m) => Math.max(STEP, Math.round((m * scale) / STEP) * STEP));
  }
  return totals;
}

const PASS_LABEL = { learn: 'Study', practice: 'Targeted Practice', review: 'Review', reassess: 'Reassessment' };

/**
 * Splits ONE topic's whole-plan total budget into an ordered pass sequence - never a single lump
 * sum. How many passes (2-4) and each one's share scale with the topic's own total: a small budget
 * only affords Study + Targeted Practice; a large one (very weak topic + generous plan) affords
 * the full Study -> Targeted Practice -> Review Incorrect -> Reassessment depth. This is what
 * makes "5 hours/day" produce DEEPER passes instead of more identical-sized blocks.
 */
// A single sitting has a sensible ceiling regardless of how large a topic's whole-plan budget
// is - a topic with a huge total (very weak topic on a generous plan) gets REPEATED, capped-size
// passes instead of one implausible 150+ minute block. This is what "revisit weak topics rather
// than completing a topic once and never showing it again" actually means in practice.
const MAX_PASS_MINUTES = 60;
// Safety valve on the number of passes one topic can generate - keeps a pathological
// few-topics/huge-budget combination from producing dozens of tiny fragments.
const MAX_PASSES_PER_TOPIC = 10;
// First pass through the full cycle is Study -> Practice -> Review -> Reassessment; once a topic
// has had its one fresh Study pass, further budget cycles through reinforcement only (never a
// second "Study" - by then the student has already been taught the content once).
const FIRST_CYCLE = ['learn', 'practice', 'review', 'reassess'];
const REPEAT_CYCLE = ['practice', 'review', 'reassess'];

function buildTopicPasses(totalMinutes) {
  if (totalMinutes <= 0) return [];
  // A genuinely tight plan (buildTopicBudgets' scale-down branch) can hand a topic less than one
  // normal pass' worth of time - give it a single short Study touch rather than nothing at all;
  // some coverage of every qualifying topic beats a clean-but-empty schedule for this one.
  if (totalMinutes < MIN_PASS_MINUTES) {
    return [{ type: 'learn', minutes: Math.max(STEP, Math.round(totalMinutes / STEP) * STEP) }];
  }

  const passes = [];
  let remaining = totalMinutes;

  while (remaining >= MIN_PASS_MINUTES && passes.length < MAX_PASSES_PER_TOPIC) {
    const type = passes.length < FIRST_CYCLE.length
      ? FIRST_CYCLE[passes.length]
      : REPEAT_CYCLE[(passes.length - FIRST_CYCLE.length) % REPEAT_CYCLE.length];

    // Each pass takes a share of what's LEFT (front-loaded - Study/the first pass gets the
    // biggest single share), capped so no single block balloons past MAX_PASS_MINUTES.
    const share = passes.length === 0 ? 0.45 : 0.4;
    let minutes = Math.round((remaining * share) / STEP) * STEP;
    minutes = Math.min(MAX_PASS_MINUTES, Math.max(MIN_PASS_MINUTES, minutes));
    if (minutes > remaining) minutes = Math.max(0, Math.round(remaining / STEP) * STEP);
    if (minutes < MIN_PASS_MINUTES) break;

    passes.push({ type, minutes });
    remaining -= minutes;
  }

  // A small leftover fragment (< MIN_PASS_MINUTES) is folded into the last real pass rather than
  // dropped or left as an unschedulable sliver.
  if (remaining > 0 && passes.length > 0) {
    passes[passes.length - 1].minutes += remaining;
  }

  return passes;
}

/**
 * Greedy day-by-day scheduler. Each topic contributes AT MOST ONE pass per day (its own next
 * pending pass, in Study -> Practice -> Review -> Reassessment order) - this is what spaces a
 * topic's passes across different days instead of finishing it in one sitting, and what makes two
 * topics on the same day genuinely different durations (a topic's Study pass and another topic's
 * Review pass are different-sized activities, never a shared "day budget / topic count" split).
 * Only allows a second pass from an ALREADY-touched-today topic once every other topic's next
 * pass has been placed and capacity still remains (keeps a generous day/topic ratio - e.g. 5
 * hrs/day with few topics - from sitting mostly empty). Finishes with a coverage-guarantee sweep:
 * any topic that never got even its first (Study) pass placed - because the greedy day-by-day pass
 * ran out of days/room for it - is force-injected into whichever day has the most spare capacity,
 * shrunk to fit if necessary. Full coverage of every qualifying topic matters more than a clean
 * round number for one day.
 */
function scheduleDays(topics, regularDayCount, capMinutesPerDay) {
  if (regularDayCount <= 0) return [];

  const queues = topics.map((t) => ({
    topic: t,
    passes: buildTopicPasses(t.totalBudgetMinutes),
    weight: computeTopicWeight(t),
    placedAny: false
  }));

  const dayTasksList = [];
  const dayRemaining = [];

  for (let d = 0; d < regularDayCount; d++) {
    let remaining = capMinutesPerDay;
    const usedToday = new Set();
    // `${topic.key}::${type}` - a topic's OWN pass queue can genuinely contain the same activity
    // type more than once (REPEAT_CYCLE), so "used today" alone isn't enough to stop a topic
    // placing e.g. two Review passes on the same day once tryFill(true) allows repeats; this
    // guards the literal (topic, type, day) combination instead.
    const usedTypeToday = new Set();
    const dayTasks = [];

    const tryFill = (allowRepeat) => {
      let placed = true;
      // Gate on STEP, not MIN_PASS_MINUTES: a normal pass never fits in under MIN_PASS_MINUTES
      // anyway, but a genuinely tight plan can produce shorter sub-floor passes (see
      // buildTopicPasses) that a stricter gate here would wrongly refuse to place.
      while (placed && remaining >= STEP) {
        placed = false;
        const candidates = queues
          .filter((q) => q.passes.length > 0 && (allowRepeat || !usedToday.has(q.topic.key)))
          // Coverage first: a topic that has NEVER had any pass placed anywhere in the plan yet
          // always outranks one that's already received at least its first pass, regardless of
          // weight - otherwise a few high-weight topics' repeat/reinforcement passes can keep
          // winning every day and a lower-weight topic never gets its essential first pass at
          // all (the exact "topic never scheduled" failure this ordering fixes). Weight only
          // breaks ties among topics at the same coverage stage.
          .sort((a, b) => {
            if (a.placedAny !== b.placedAny) return a.placedAny ? 1 : -1;
            return b.weight - a.weight;
          });
        for (const cand of candidates) {
          const nextPass = cand.passes[0];
          const typeKey = `${cand.topic.key}::${nextPass.type}`;
          if (usedTypeToday.has(typeKey)) continue;
          if (nextPass.minutes <= remaining) {
            cand.passes.shift();
            cand.placedAny = true;
            dayTasks.push({ topic: cand.topic, type: nextPass.type, minutes: nextPass.minutes });
            remaining -= nextPass.minutes;
            usedToday.add(cand.topic.key);
            usedTypeToday.add(typeKey);
            placed = true;
            break;
          }
        }
      }
    };

    tryFill(false); // one pass per topic per day, worst-first
    tryFill(true);  // only if real capacity is still left over, allow a topic to appear twice today

    dayTasksList.push(dayTasks);
    dayRemaining.push(remaining);
  }

  queues.forEach((q) => {
    if (q.placedAny || q.passes.length === 0) return;
    let bestDay = 0;
    for (let d = 1; d < regularDayCount; d++) {
      if (dayRemaining[d] > dayRemaining[bestDay]) bestDay = d;
    }
    const firstPass = q.passes[0];
    const minutes = Math.floor(Math.min(firstPass.minutes, dayRemaining[bestDay]) / STEP) * STEP;
    if (minutes < STEP) return; // truly no room anywhere left - last resort, never blow the daily cap
    dayTasksList[bestDay].push({ topic: q.topic, type: firstPass.type, minutes });
    dayRemaining[bestDay] -= minutes;
    q.passes.shift();
    q.placedAny = true;
  });

  return dayTasksList.map((dayTasks, i) => buildRegularDayFromTasks(i + 1, dayTasks));
}

/**
 * Converts one day's placed passes into the final day object. Same-topic passes placed on the
 * same day (the rare `tryFill(true)` double-dip) are summed into ONE row in the day's subject
 * summary card, so "Today's Focus" never shows a topic listed twice just because it received two
 * different activities today.
 */
function buildRegularDayFromTasks(dayNumber, dayTasks) {
  const tasks = [];
  const subjectBuckets = new Map();
  const topicRows = new Map(); // subjectKey -> Map(topicName -> row)

  dayTasks.forEach(({ topic: t, type, minutes }) => {
    const recommendedLevel = t.recommendedLevel || getRecommendedLevel(t.accuracy);
    const routingLevel = routingLevelFor(recommendedLevel);
    tasks.push({
      subject: t.section,
      topic: t.topic,
      originalAccuracy: t.accuracy,
      recommendedLevel,
      courseId: t.courseId || null,
      level: routingLevel,
      type,
      minutes,
      completed: false,
      label: `${PASS_LABEL[type]}: ${t.topic} — ${recommendedLevel} Level`
    });

    const subjectKey = t.section || 'General';
    if (!subjectBuckets.has(subjectKey)) {
      subjectBuckets.set(subjectKey, { subject: subjectKey, minutes: 0, topics: [] });
      topicRows.set(subjectKey, new Map());
    }
    const bucket = subjectBuckets.get(subjectKey);
    const rows = topicRows.get(subjectKey);
    bucket.minutes += minutes;
    if (rows.has(t.topic)) {
      rows.get(t.topic).minutes += minutes;
    } else {
      const row = { topic: t.topic, minutes, accuracy: t.accuracy, recommendedLevel, courseId: t.courseId || null };
      rows.set(t.topic, row);
      bucket.topics.push(row);
    }
  });

  return {
    dayNumber,
    totalMinutes: tasks.reduce((sum, t) => sum + t.minutes, 0),
    subjects: Array.from(subjectBuckets.values()),
    tasks,
    isFinalTest: false
  };
}

function buildFinalTestDay(dayNumber, totalMinutesPerDay, currentScore, targetScore) {
  // Round the first two shares independently, then give the THIRD whatever is left over - rounding
  // each of three independent percentages (0.75/0.15/0.1) can otherwise land 1 minute over the cap
  // (e.g. 30 * 0.75/0.15/0.1 rounds to 23/5/3 = 31), which is exactly the "never exceed the
  // selected hours" rule this whole file exists to enforce.
  const timedPractice = clampMinutes(totalMinutesPerDay * 0.75);
  const review = clampMinutes(totalMinutesPerDay * 0.15);
  const compare = Math.max(0, totalMinutesPerDay - timedPractice - review);
  const tasks = [
    {
      type: 'timed_practice',
      label: 'Timed Full-Length Practice Test',
      minutes: timedPractice,
      completed: false
    },
    {
      type: 'review',
      label: 'Review Every Mistake From Today’s Test',
      minutes: review,
      completed: false
    },
    {
      type: 'compare',
      label: `Compare Today's Score Against Your Previous ${currentScore}`,
      minutes: compare,
      completed: false,
      meta: { previousScore: currentScore, targetScore }
    }
  ];
  return {
    dayNumber,
    totalMinutes: tasks.reduce((sum, t) => sum + t.minutes, 0),
    subjects: [],
    isFinalTest: true,
    tasks
  };
}

/**
 * weaknesses: [{ topic, section ('Math'|'Reading & Writing'), accuracy, total, correct,
 *   incorrect, unanswered, priorityScore, courseId? }], already sorted or not (re-sorted here).
 * Returns an array of day objects. The last day is reserved for a full timed practice test
 * whenever the plan is long enough to afford dedicating a whole day to it (numDays >= 3);
 * shorter plans use every day for targeted prep since there's no spare day to give up.
 *
 * Total-available-time-first, not weakness-count-first: the WHOLE plan's workload (see
 * buildTopicBudgets/buildTopicPasses/scheduleDays above) is computed BEFORE any single day is
 * built, so no day's topic durations are ever a function of "today's topic count" alone - that
 * derivation is exactly what previously reproduced a flat 45-min-per-topic result whenever a
 * day's topics happened to share a tier. Every subject's topics are pulled from ONE
 * priority-and-accuracy-weighted pool (see computeTopicWeight) rather than a fixed per-subject
 * time split, so the Math/Reading & Writing balance in the plan reflects how many/how bad each
 * subject's actual weaknesses are, not an even or arbitrary division.
 */
export function buildDayByDayPlan({ weaknesses = [], currentScore, targetScore, hoursPerDay, numDays }) {
  const capMinutesPerDay = clampMinutes(hoursPerDay * 60);
  const hasFinalTestDay = numDays >= 3;
  const regularDayCount = hasFinalTestDay ? numDays - 1 : numDays;

  const topics = (weaknesses.length > 0
    ? weaknesses
    : [{ topic: 'General Review', section: 'Math', accuracy: null, priorityScore: 1, courseId: null }]
  )
    .map((w) => ({
      ...w,
      recommendedLevel: w.recommendedLevel || getRecommendedLevel(w.accuracy),
      key: `${w.section}::${w.topic}`
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  // Step 1+2 (see module doc above buildTopicBudgets): total minutes across the WHOLE plan, then
  // how much of that each topic should get overall - answered ONCE, before any day exists.
  const totalWorkloadMinutes = capMinutesPerDay * regularDayCount;
  const topicBudgets = buildTopicBudgets(topics, totalWorkloadMinutes);
  topics.forEach((t, i) => { t.totalBudgetMinutes = topicBudgets[i]; });

  // Steps 3+4: break each topic's total into passes and spread them across the days, respecting
  // the daily cap as a hard limit (scheduleDays never returns a day over capMinutesPerDay).
  const days = scheduleDays(topics, regularDayCount, capMinutesPerDay);

  if (hasFinalTestDay) {
    days.push(buildFinalTestDay(numDays, capMinutesPerDay, currentScore, targetScore));
  }

  const { violations } = validateGeneratedPlan(days, { capMinutesPerDay, weaknesses: topics });
  if (violations.length > 0) {
    // Every violation class here is defended against structurally above (scheduleDays never
    // exceeds capMinutesPerDay, a topic's passes are always distinct types, and the coverage-
    // guarantee sweep force-places any topic that never got its first pass), so reaching this
    // should never happen in practice - a last-resort signal one of those invariants broke, not a
    // normal code path, so it only logs rather than failing the request.
    console.warn('[customPrepPlanner] generated plan failed validation:', violations);
  }

  return days;
}

/**
 * Final validation pass, run on every generated plan before it's returned (see buildDayByDayPlan):
 *  - no day's total minutes exceed the student's selected daily capacity
 *  - no day contains two identical Study/Practice/Review tasks for the same topic
 *  - every qualifying weak topic is scheduled at least once somewhere in the plan
 * Returns { valid, violations } - a list of human-readable strings, not thrown errors, since this
 * runs after generation purely as a safety net (see the structural guarantees noted above).
 */
export function validateGeneratedPlan(days, { capMinutesPerDay, weaknesses = [] } = {}) {
  const violations = [];

  days.forEach((day) => {
    if (day.totalMinutes > capMinutesPerDay) {
      violations.push(`Day ${day.dayNumber}: ${day.totalMinutes} min exceeds the ${capMinutesPerDay} min daily capacity`);
    }
    const seen = new Set();
    (day.tasks || []).forEach((t) => {
      const key = `${t.subject}::${t.topic}::${t.type}`;
      if (seen.has(key)) violations.push(`Day ${day.dayNumber}: duplicate "${t.type}" task for "${t.topic}"`);
      seen.add(key);
    });
  });

  const coveredTopics = new Set();
  days.forEach((day) => (day.tasks || []).forEach((t) => {
    if (t.topic) coveredTopics.add(`${t.subject}::${t.topic}`);
  }));
  weaknesses.forEach((w) => {
    const key = `${w.section}::${w.topic}`;
    if (!coveredTopics.has(key)) violations.push(`"${w.topic}" (${w.section}) was never scheduled in the generated plan`);
  });

  return { valid: violations.length === 0, violations };
}
