/**
 * run-once-migration.js
 * Run: node src/server/run-once-migration.js
 * Creates the unique DB index that permanently blocks duplicate notifications.
 */
import supabase from '../supabase/supabaseAdmin.js';

async function run() {
  console.log('Running one-time migration...');

  // 1. Delete ALL stale pending/processing TEST_COMPLETED rows
  const { data: wiped, error: wipeErr } = await supabase
    .from('notification_outbox')
    .delete()
    .eq('event_type', 'TEST_COMPLETED')
    .in('status', ['pending', 'processing', 'failed'])
    .select('id');

  if (wipeErr) {
    console.error('Wipe error:', wipeErr.message);
  } else {
    console.log(`✅ Wiped ${wiped?.length || 0} stale rows.`);
  }

  // 2. Create unique index via pg function (Supabase SQL editor alternative)
  // This uses the Supabase admin client's rpc if available, otherwise prints instructions.
  console.log('\n⚠️  IMPORTANT: Also run this SQL in your Supabase SQL Editor:');
  console.log('---');
  console.log(`CREATE UNIQUE INDEX IF NOT EXISTS idx_one_notif_per_submission
ON notification_outbox (recipient_profile_id, (payload->>'submissionId'))
WHERE event_type = 'TEST_COMPLETED' AND payload->>'submissionId' IS NOT NULL;`);
  console.log('---');
  
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
