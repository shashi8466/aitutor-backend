-- ==========================================================
-- FIX: POPULATE GRADE SCALES & FIX STUDENT ROSTER
-- ==========================================================

-- 1. Insert default scales for SAT MATH (Course 1)
-- Math Section
INSERT INTO grade_scales (course_id, section, min_scaled_score, max_scaled_score, scale_type, is_active)
VALUES (1, 'math', 200, 800, 'linear', true)
ON CONFLICT DO NOTHING;

-- Reading/Writing Sections (SAT uses 400-800 for each or 200-800)
INSERT INTO grade_scales (course_id, section, min_scaled_score, max_scaled_score, scale_type, is_active)
VALUES (1, 'reading', 200, 800, 'linear', true)
ON CONFLICT DO NOTHING;

INSERT INTO grade_scales (course_id, section, min_scaled_score, max_scaled_score, scale_type, is_active)
VALUES (1, 'writing', 200, 800, 'linear', true)
ON CONFLICT DO NOTHING;

-- Overall
INSERT INTO grade_scales (course_id, section, min_scaled_score, max_scaled_score, scale_type, is_active)
VALUES (1, 'overall', 400, 1600, 'linear', true)
ON CONFLICT DO NOTHING;

-- Repeat for Course 4
INSERT INTO grade_scales (course_id, section, min_scaled_score, max_scaled_score, scale_type, is_active)
VALUES (4, 'math', 200, 800, 'linear', true)
ON CONFLICT DO NOTHING;
INSERT INTO grade_scales (course_id, section, min_scaled_score, max_scaled_score, scale_type, is_active)
VALUES (4, 'reading', 200, 800, 'linear', true)
ON CONFLICT DO NOTHING;
INSERT INTO grade_scales (course_id, section, min_scaled_score, max_scaled_score, scale_type, is_active)
VALUES (4, 'writing', 200, 800, 'linear', true)
ON CONFLICT DO NOTHING;
INSERT INTO grade_scales (course_id, section, min_scaled_score, max_scaled_score, scale_type, is_active)
VALUES (4, 'overall', 400, 1600, 'linear', true)
ON CONFLICT DO NOTHING;

-- 2. Retroactively update existing submissions from N/A to calculated scores
-- This uses the calculate_scaled_score function we just fixed scales for
UPDATE test_submissions 
SET 
  math_scaled_score = calculate_scaled_score(course_id, 'math', math_raw_score, math_total_questions),
  reading_scaled_score = calculate_scaled_score(course_id, 'reading', reading_raw_score, reading_total_questions),
  writing_scaled_score = calculate_scaled_score(course_id, 'writing', writing_raw_score, writing_total_questions),
  scaled_score = calculate_scaled_score(course_id, 'overall', raw_score, 100) -- Fallback if total_questions wasn't saved correctly
WHERE scaled_score IS NULL;
