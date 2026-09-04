/*
# Rename support_issues status values to match the Admin UI's terminology
'in_review' -> 'in_progress', 'archived' -> 'closed' (pending/resolved unchanged)
*/

ALTER TABLE support_issues DROP CONSTRAINT IF EXISTS support_issues_status_check;

UPDATE support_issues SET status = 'in_progress' WHERE status = 'in_review';
UPDATE support_issues SET status = 'closed' WHERE status = 'archived';

ALTER TABLE support_issues ADD CONSTRAINT support_issues_status_check
  CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed'));
