/*
# Student Group Content Deadline (Start Date/Time / End Date/Time)

Adds an optional active-content window to a Student Group and makes the existing group-content
access grant (get_group_granted_course_ids, added in
1787310253951-group_content_access_enforcement.sql) respect it:

- Before start_date: the group's assigned content is not yet accessible.
- Between start_date and end_date (inclusive): normal access, unchanged from today.
- After end_date: the group's assigned content is expired/inaccessible.

start_date/end_date are timestamptz (not just date) so an admin/tutor can optionally pin an
exact time of day (e.g. "Sep 10, 2026 9:00 AM"); when only a date is given, the client sends
midnight for start_date and 23:59:59 for end_date, so the whole day stays covered - "full-day
behavior" when no time is specified.

Both columns are nullable and default to NULL, so every EXISTING group (none of which set a
date today) keeps its exact current behavior - the date filter below is a pure no-op unless a
group explicitly sets start_date/end_date. This only affects access GRANTED VIA THIS GROUP; a
student's direct access (enrollment, premium plan, whole-course plan whitelist -
has_direct_course_access) and access via any OTHER group are completely unaffected, matching
is_course_accessible's existing "additive on top of direct access" design.

deadline_processed_at marks when the one-time "missed content" deadline email run has already
processed this group's expiry, so the daily cron job never re-scans/re-sends for the same group.
*/

ALTER TABLE student_groups
  ADD COLUMN IF NOT EXISTS start_date timestamptz,
  ADD COLUMN IF NOT EXISTS end_date timestamptz,
  ADD COLUMN IF NOT EXISTS deadline_processed_at timestamptz;

CREATE OR REPLACE FUNCTION get_group_granted_course_ids(p_user_id uuid)
RETURNS bigint[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT cid), '{}'::bigint[])
  FROM group_members gm
  JOIN student_groups sg ON sg.id = gm.group_id
  CROSS JOIN LATERAL unnest(COALESCE(sg.assigned_course_ids, '{}'::bigint[])) AS cid
  WHERE gm.student_id = p_user_id
    AND (sg.start_date IS NULL OR now() >= sg.start_date)
    AND (sg.end_date IS NULL OR now() <= sg.end_date);
$$;

GRANT EXECUTE ON FUNCTION get_group_granted_course_ids(uuid) TO authenticated;
