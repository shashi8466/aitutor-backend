import 'dotenv/config';
import supabase from './src/supabase/supabaseAdmin.js';
import NotificationScheduler from './src/server/services/NotificationScheduler.js';
import { processOutboxOnce } from './src/server/utils/notificationOutbox.js';

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.log('Usage: node send_latest_test_report.mjs "<student name or email>"');
  process.exit(1);
}

function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

const scheduler = new NotificationScheduler();

let finished = false;
function finish(code) {
  if (finished) return;
  finished = true;
  process.exitCode = code;
  // Give any pending async handles a moment to settle on Windows/Node.
  setTimeout(() => process.exit(code), 50);
}

async function main() {
  // Find student
  const q = supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('role', 'student')
    .limit(5);

  const { data: matches, error: matchErr } = await (isEmail(query)
    ? q.ilike('email', query)
    : q.ilike('name', `%${query}%`));

  if (matchErr) throw matchErr;

  if (!matches?.length) {
    console.error('No matching student found.');
    finish(2);
    return;
  }

  if (matches.length > 1) {
    console.error('Multiple students matched. Re-run with a more specific name/email.');
    for (const m of matches) console.error(`- ${m.name} <${m.email || 'no email'}> (${m.id})`);
    finish(3);
    return;
  }

  const student = matches[0];

  // Latest submission
  const { data: latest, error: latestErr } = await supabase
    .from('test_submissions')
    .select('id, test_date, raw_score_percentage, scaled_score')
    .eq('user_id', student.id)
    .order('test_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr) throw latestErr;

  if (!latest?.id) {
    console.error(`No test submissions found for ${student.name} (${student.id}).`);
    finish(4);
    return;
  }

  console.log(`Triggering score report for ${student.name} (${student.id}) submission ${latest.id}...`);

  await scheduler.triggerTestCompletionNotification(latest.id, student.id);
  const processed = await processOutboxOnce({ limit: 25 });

  console.log('Done.');
  console.log(JSON.stringify({ studentId: student.id, submissionId: latest.id, processed }, null, 2));
  finish(0);
}

main().catch((err) => {
  console.error('Failed:', err?.message || err);
  finish(1);
});

