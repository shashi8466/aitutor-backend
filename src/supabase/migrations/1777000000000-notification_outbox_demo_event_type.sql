-- Allow the new DEMO_TEST_COMPLETED event type used by the public demo/full-length SAT test's
-- mandatory result email. The original migration's CHECK constraint only listed
-- ('TEST_COMPLETED','WEEKLY_REPORT','DUE_DATE_REMINDER'), but the live database has since
-- diverged from that (confirmed live rows already exist with 'CONTACT_SUBMISSION' and
-- 'TEST_INSERT', neither of which is in that original list) - so this migration explicitly
-- drops and recreates the constraint with every event_type value seen in the live table today
-- (a plain ADD CONSTRAINT validates existing rows, so omitting any of them would fail this
-- migration outright) plus every value the application code actually uses, plus the new one.

alter table public.notification_outbox drop constraint if exists notification_outbox_event_type_check;

alter table public.notification_outbox add constraint notification_outbox_event_type_check
  check (event_type in (
    'TEST_COMPLETED',
    'WEEKLY_REPORT',
    'DUE_DATE_REMINDER',
    'WELCOME_EMAIL',
    'CONTACT_SUBMISSION',
    'TEST_INSERT',
    'DEMO_TEST_COMPLETED'
  ));
