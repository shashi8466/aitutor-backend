-- ================================================================
-- EMERGENCY: Run this NOW in Supabase SQL Editor to stop spam
-- ================================================================

-- STEP 1: WIPE all pending/processing/failed TEST_COMPLETED rows.
-- This immediately stops the retry loop sending duplicate emails.
DELETE FROM notification_outbox
WHERE event_type = 'TEST_COMPLETED'
  AND status IN ('pending', 'processing', 'failed');

-- STEP 2: Install unique index so the DB itself blocks future duplicates.
-- Even if app code has a bug, the DB will reject a second INSERT.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_notification_per_submission
ON notification_outbox (
  recipient_profile_id,
  (payload->>'submissionId')
)
WHERE event_type = 'TEST_COMPLETED'
  AND payload->>'submissionId' IS NOT NULL;

-- STEP 3: Verify — pending count should now be 0
SELECT status, count(*)
FROM notification_outbox
WHERE event_type = 'TEST_COMPLETED'
GROUP BY status;
