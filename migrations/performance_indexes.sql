-- Performance Optimization: Adding indexes to frequently queried columns

-- 1. Test Submissions
CREATE INDEX IF NOT EXISTS idx_test_submissions_user_id ON test_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_test_submissions_course_id ON test_submissions(course_id);
CREATE INDEX IF NOT EXISTS idx_test_submissions_test_date ON test_submissions(test_date DESC);

-- 2. Student Progress
CREATE INDEX IF NOT EXISTS idx_student_progress_user_id ON student_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_course_id ON student_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_level ON student_progress(level);

-- 3. Questions
CREATE INDEX IF NOT EXISTS idx_questions_course_id ON questions(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_upload_id ON questions(upload_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);

-- 4. Test Responses (Large table, very important for history/review)
CREATE INDEX IF NOT EXISTS idx_test_responses_submission_id ON test_responses(submission_id);
CREATE INDEX IF NOT EXISTS idx_test_responses_question_id ON test_responses(question_id);

-- 5. Profiles (already has some, but ensuring complete)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 6. Enrollments (already has some, but ensuring complete)
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
