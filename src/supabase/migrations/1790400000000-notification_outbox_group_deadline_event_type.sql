-- Allow the new GROUP_DEADLINE_MISSED_CONTENT event_type: the automatic "group content
-- deadline ended - here's what you missed" email sent to a student and their linked parent(s)
-- once a Student Group's assigned-content end_date passes. See
-- notifications.js POST /run-group-deadline-check and
-- analyticsService.getGroupDeadlineCompletionReport.
--
-- Re-derives the full allowed list the same way 1788350000000 did - a plain ADD CONSTRAINT
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
    'TOPIC_COURSE_COMPLETED',
    'GROUP_DEADLINE_MISSED_CONTENT'
  ));
