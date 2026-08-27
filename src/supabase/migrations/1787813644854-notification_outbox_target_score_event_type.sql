-- Allow a new TARGET_SCORE_REACHED event_type, used purely as a durable "the student first
-- crossed their target SAT score" record (see analyticsService.getStudentTargetProgress) -
-- inserted directly with status='sent' so it's never picked up by the outbox's actual
-- notification-delivery worker (processOutboxOnce only selects status='pending' rows). This is
-- not a real outbound notification; it's reusing this table's existing per-recipient
-- idempotency guarantees to store the one-time achievement payload (score/target/trigger).
--
-- Re-derives the full allowed list the same way 1777000000000 did - a plain ADD CONSTRAINT
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
    'TARGET_SCORE_REACHED'
  ));
