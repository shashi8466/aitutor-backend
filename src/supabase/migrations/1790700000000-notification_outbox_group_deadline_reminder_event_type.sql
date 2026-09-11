-- Allow the new GROUP_DEADLINE_REMINDER event_type: the automatic "deadline in 5 days / 2 days /
-- today" reminder email sent to a student and their linked parent(s) in the run-up to a Student
-- Group's assigned-content end_date, BEFORE it actually passes (see
-- notifications.js POST /run-group-deadline-reminders). Distinct from
-- GROUP_DEADLINE_MISSED_CONTENT, which only fires AFTER the deadline has passed.
--
-- Re-derives the full allowed list the same way prior event_type migrations did - a plain ADD
-- CONSTRAINT validates every existing row, so every event_type value already live in the table
-- must be included or this migration fails outright.

alter table public.notification_outbox drop constraint if exists notification_outbox_event_type_check;

alter table public.notification_outbox add constraint notification_outbox_event_type_check
  check (event_type in (
    'TEST_COMPLETED',
    'WEEKLY_REPORT',
    'DUE_DATE_REMINDER',
    'WELCOME_EMAIL',
    'CONTACT_SUBMISSION',
    'TEST_INSERT',
    'DEMO_TEST_COMPLETED',
    'TARGET_SCORE_REACHED',
    'TOPIC_COURSE_COMPLETED',
    'GROUP_DEADLINE_MISSED_CONTENT',
    'GROUP_DEADLINE_REMINDER'
  ));
