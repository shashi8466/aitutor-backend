-- Recordings v2: Course Recordings vs Platform Recordings, and group-based visibility.
--
-- Two changes:
-- 1. recordings gets a recording_type (course|platform). A "platform" recording (tutorial/help
--    video, not tied to any SAT/ACT/AP/Full-Length course) gets a platform_category instead of
--    the existing category/course_id fields, and an `availability` of either 'groups' (must be
--    assigned to a group, same as every course recording) or 'all_students' (visible to every
--    eligible student regardless of group - e.g. "Welcome to AIPrep365").
-- 2. student_groups gets assigned_recording_ids, the EXACT same pattern as its existing
--    assigned_course_ids column (a flat bigint[], not a join table) - deliberately reusing the
--    existing group system rather than building a parallel one. This also means recordings
--    automatically inherit each group's own start_date/end_date as their (shared, per-group,
--    already-supports-different-deadlines-per-group) deadline window - no new deadline
--    infrastructure needed, since a group's window already differs group-to-group.

ALTER TABLE recordings
  ADD COLUMN IF NOT EXISTS recording_type text NOT NULL DEFAULT 'course' CHECK (recording_type IN ('course', 'platform')),
  ADD COLUMN IF NOT EXISTS platform_category text,
  ADD COLUMN IF NOT EXISTS availability text CHECK (availability IN ('groups', 'all_students'));

-- The original 1790600000000-create_recordings.sql made `category` NOT NULL (every recording used
-- to be a Course Recording, always with a category). A Platform Recording has no category at all
-- (it uses platform_category instead) and stores NULL there - relax the constraint so that insert
-- doesn't violate "null value in column category". The existing CHECK(category IN (...)) already
-- permits NULL on its own (a CHECK only rejects an explicit FALSE, not NULL), so nothing else to change.
ALTER TABLE recordings ALTER COLUMN category DROP NOT NULL;

-- Every existing (course) recording is 'groups' availability by definition (it always required a
-- course/topic association, never a global broadcast) - backfill so the column is never null for
-- rows that predate this migration.
UPDATE recordings SET availability = 'groups' WHERE availability IS NULL;

ALTER TABLE student_groups
  ADD COLUMN IF NOT EXISTS assigned_recording_ids bigint[] NOT NULL DEFAULT '{}';
