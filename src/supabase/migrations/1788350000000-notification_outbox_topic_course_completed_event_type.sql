-- Allow the new TOPIC_COURSE_COMPLETED event_type: the combined Easy+Medium+Hard
-- regular-course completion email (one email per course completion, replacing the old
-- one-email-per-level behavior). See NotificationScheduler.triggerCombinedCourseCompletionNotification.
--
-- Re-derives the full allowed list the same way 1787813644854 did - a plain ADD CONSTRAINT
-- validates every existing row, so every event_type value already live in the table must be
-- included or this migration fails outright.

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
    'TOPIC_COURSE_COMPLETED'
  ));
