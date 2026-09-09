/*
# Tutor Dashboard / Group Analytics - Performance Indexes

Pure indexing migration (no schema, data, or behavior change) to speed up the two slowest
tutor-facing pages:

1. `enrollments(course_id)` - the Tutor Dashboard's stats query
   (`src/server/routes/tutor.js`, `GET /api/tutor/dashboard`) and the `get_tutor_courses` RPC
   both filter/join purely on `course_id`. The table only had a composite
   `UNIQUE(user_id, course_id)` index (leading column `user_id`), which Postgres can't use
   efficiently for a `course_id`-only lookup - `IF NOT EXISTS` guards against the separate
   `migrations/performance_indexes.sql` reference script having already created this on some
   environments.
2. `test_submissions(user_id, course_id)` - every per-(student, course) analytics query in
   `analyticsService.getTopicCombinedReport()` (the function backing the Tutor Group Analytics
   drill-down, called once per student per course) filters on both columns together via
   `.eq('user_id', ...).eq('course_id', ...)`. Only single-column indexes existed for each side
   separately, forcing a bitmap AND of two indexes instead of one composite index scan - this
   matters most exactly because that drill-down already fans out to many concurrent calls of
   this query for a large group.
*/

CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_test_submissions_user_course ON test_submissions(user_id, course_id);
