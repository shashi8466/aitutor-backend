import supabase from '../../supabase/supabaseAdmin.js';

// The one place that decides how many weekly-report emails may be sent in a single day.
// Configurable via env (not hard-coded) so raising the email provider's daily quota later never
// requires a code change - only WEEKLY_REPORT_DAILY_LIMIT in the environment. Default of 230
// deliberately leaves ~70 of a 300/day provider quota for OTHER transactional email (OTP,
// password reset, account emails, test-completion notifications, etc.) - this scheduler must
// never consume the whole daily quota by itself.
export function getDailyLimit() {
  const fromEnv = Number(process.env.WEEKLY_REPORT_DAILY_LIMIT);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 230;
}

// How many times a single delivery is retried (across however many days) before it's left FAILED
// for good and stops competing with fresh sends for capacity.
export function getMaxRetryAttempts() {
  const fromEnv = Number(process.env.WEEKLY_REPORT_MAX_ATTEMPTS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 3;
}

export const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

// The order NEW students fill cohorts in - matches the exact fill order from the product
// examples (Tuesday first, Monday last as the overflow day). Does not affect students who already
// have an assigned day; only where a brand-new student lands.
const FILL_ORDER = ['TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'MONDAY'];

const REPORT_TIMEZONE = 'Asia/Kolkata'; // matches NotificationScheduler's own cron timezone

function getLocalDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const map = {};
  parts.forEach((p) => { if (p.type !== 'literal') map[p.type] = p.value; });
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

// 'MONDAY'..'FRIDAY' for the given instant, evaluated in the same timezone the scheduler's own
// cron runs in - or null on a Saturday/Sunday (weekly reports don't run on weekends).
export function getTodayWeekdayName(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: REPORT_TIMEZONE, weekday: 'long' }).format(date).toUpperCase();
  return WEEKDAYS.includes(weekday) ? weekday : null;
}

// ISO-8601 week key (e.g. "2026-W40") for the given instant's LOCAL calendar date - this is the
// "report_week" every delivery is filed under, so a student's Tuesday-vs-Wednesday-vs-Thursday
// send within the SAME cycle is still recognized as "already handled this week" once any of them
// succeeds, and so week N+1 is unambiguously a fresh cycle regardless of which day within it runs.
export function getReportWeekKey(date = new Date()) {
  const { year, month, day } = getLocalDateParts(date);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of the same ISO week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((d - firstThursday) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Permanently assigns a weekly_report_day to every eligible student who doesn't already have one
 * - covers both the one-time initial rollout (every existing student is "new" the first time this
 * runs) and any student who signs up afterward. NEVER touches a student who already has a row -
 * that is the whole point of this system (no weekly reshuffling). New students fill whichever
 * cohort still has spare capacity, in FILL_ORDER; if every cohort is at/over the daily limit
 * (extreme scale), assigns to the least-loaded day rather than leaving the student unassigned
 * forever.
 */
export async function assignUnassignedStudents() {
  const [{ data: students, error: studentsErr }, { data: scheduleRows, error: scheduleErr }] = await Promise.all([
    supabase.from('profiles').select('id').eq('role', 'student'),
    supabase.from('student_weekly_report_schedule').select('student_id, weekly_report_day').eq('active', true)
  ]);
  if (studentsErr) throw studentsErr;
  if (scheduleErr) throw scheduleErr;

  const assignedIds = new Set((scheduleRows || []).map((r) => r.student_id));
  const unassigned = (students || []).filter((s) => !assignedIds.has(s.id));
  if (unassigned.length === 0) return 0;

  const counts = {};
  FILL_ORDER.forEach((d) => { counts[d] = 0; });
  (scheduleRows || []).forEach((r) => {
    if (counts[r.weekly_report_day] != null) counts[r.weekly_report_day]++;
  });

  const dailyLimit = getDailyLimit();
  const newRows = unassigned.map((student) => {
    let day = FILL_ORDER.find((d) => counts[d] < dailyLimit);
    if (!day) {
      day = FILL_ORDER.reduce((least, d) => (counts[d] < counts[least] ? d : least), FILL_ORDER[0]);
    }
    counts[day]++;
    return { student_id: student.id, weekly_report_day: day };
  });

  const { error: insertErr } = await supabase.from('student_weekly_report_schedule').insert(newRows);
  if (insertErr) throw insertErr;
  return newRows.length;
}

/**
 * Makes sure every active, assigned student has a (PENDING) delivery row for this report_week -
 * idempotent (ON CONFLICT on the student_id+report_week unique constraint), so calling this
 * every day of the week is safe; a student's row is only ever created once per cycle, on
 * whichever day this first runs after their cohort exists.
 */
export async function ensureDeliveryRowsForWeek(reportWeek) {
  const { data: scheduleRows, error } = await supabase
    .from('student_weekly_report_schedule')
    .select('student_id, weekly_report_day')
    .eq('active', true);
  if (error) throw error;
  if (!scheduleRows?.length) return;

  const rows = scheduleRows.map((s) => ({
    student_id: s.student_id,
    report_week: reportWeek,
    scheduled_day: s.weekly_report_day,
    status: 'PENDING'
  }));

  const { error: upsertErr } = await supabase
    .from('weekly_report_deliveries')
    .upsert(rows, { onConflict: 'student_id,report_week', ignoreDuplicates: true });
  if (upsertErr) throw upsertErr;
}

/**
 * Claims up to `capacity` deliveries to process today: previously-FAILED ones for this
 * report_week (still under the retry limit) take priority, since they're already overdue, THEN
 * today's fresh cohort - both are claimed via an atomic status-guarded UPDATE (matching
 * notificationOutbox.processOutboxOnce's own claim pattern), so two overlapping runs of this
 * endpoint can never both claim - and therefore never both send - the same delivery. A retried
 * delivery keeps its ORIGINAL scheduled_day; it is never moved to today's cohort permanently, and
 * a student is never sent a second report for a week just because their first attempt failed and
 * was retried on a later day.
 */
export async function claimDeliveriesToProcess({ reportWeek, today, capacity }) {
  if (capacity <= 0) return [];

  const maxAttempts = getMaxRetryAttempts();
  const claimed = [];

  const { data: retryCandidates, error: retryErr } = await supabase
    .from('weekly_report_deliveries')
    .select('id')
    .eq('report_week', reportWeek)
    .eq('status', 'FAILED')
    .lt('attempt_count', maxAttempts)
    .order('created_at', { ascending: true })
    .limit(capacity);
  if (retryErr) throw retryErr;

  if (retryCandidates?.length) {
    const { data: claimedRetries, error } = await supabase
      .from('weekly_report_deliveries')
      .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
      .in('id', retryCandidates.map((r) => r.id))
      .eq('status', 'FAILED')
      .select('id, student_id, scheduled_day, attempt_count');
    if (error) throw error;
    claimed.push(...(claimedRetries || []));
  }

  const remaining = capacity - claimed.length;
  if (remaining > 0) {
    const { data: pendingCandidates, error: pendingErr } = await supabase
      .from('weekly_report_deliveries')
      .select('id')
      .eq('report_week', reportWeek)
      .eq('scheduled_day', today)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(remaining);
    if (pendingErr) throw pendingErr;

    if (pendingCandidates?.length) {
      const { data: claimedFresh, error } = await supabase
        .from('weekly_report_deliveries')
        .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
        .in('id', pendingCandidates.map((r) => r.id))
        .eq('status', 'PENDING')
        .select('id, student_id, scheduled_day, attempt_count');
      if (error) throw error;
      claimed.push(...(claimedFresh || []));
    }
  }

  return claimed;
}

export async function markDeliverySent(deliveryId) {
  await supabase
    .from('weekly_report_deliveries')
    .update({ status: 'SENT', sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
    .eq('id', deliveryId)
    .eq('status', 'PROCESSING');
}

// Always leaves the row in FAILED status - whether it's retried again is decided entirely by
// claimDeliveriesToProcess's own `attempt_count < maxAttempts` filter, not by anything set here.
export async function markDeliveryFailed(deliveryId, attemptCount, errorMessage) {
  await supabase
    .from('weekly_report_deliveries')
    .update({
      status: 'FAILED',
      attempt_count: (attemptCount || 0) + 1,
      last_error: (errorMessage || 'Unknown error').slice(0, 500),
      updated_at: new Date().toISOString()
    })
    .eq('id', deliveryId)
    .eq('status', 'PROCESSING');
}
