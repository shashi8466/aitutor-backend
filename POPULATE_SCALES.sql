-- ==========================================================
-- FIX: RE-POPULATE LEVEL-SPECIFIC GRADE SCALES
-- ==========================================================

-- First, clear ALL existing scales to ensure consistency
TRUNCATE grade_scales;

-- 1. Insert level-specific scales for SAT MATH (Course 1)
-- Math Section (Overall maps to Math for this course)
INSERT INTO grade_scales (course_id, section, level, min_raw_score, max_raw_score, min_scaled_score, max_scaled_score)
VALUES 
  (1, 'overall', 'Easy', 0, 100, 200, 500),
  (1, 'overall', 'Medium', 0, 100, 200, 650),
  (1, 'overall', 'Hard', 0, 100, 200, 800),
  (1, 'math', 'Easy', 0, 100, 200, 500),
  (1, 'math', 'Medium', 0, 100, 200, 650),
  (1, 'math', 'Hard', 0, 100, 200, 800);

-- 2. Insert level-specific scales for SAT English (Course 4)
INSERT INTO grade_scales (course_id, section, level, min_raw_score, max_raw_score, min_scaled_score, max_scaled_score)
VALUES 
  (4, 'overall', 'Easy', 0, 100, 200, 500),
  (4, 'overall', 'Medium', 0, 100, 200, 650),
  (4, 'overall', 'Hard', 0, 100, 200, 800),
  (4, 'reading', 'Easy', 0, 100, 200, 500),
  (4, 'reading', 'Medium', 0, 100, 200, 650),
  (4, 'reading', 'Hard', 0, 100, 200, 800);

-- 3. Retroactively update all existing submissions with new level-aware logic
UPDATE test_submissions 
SET 
  scaled_score = calculate_scaled_score(course_id, 'overall', raw_score, total_questions, level),
  math_scaled_score = calculate_scaled_score(course_id, 'math', math_raw_score, math_total_questions, level),
  reading_scaled_score = calculate_scaled_score(course_id, 'reading', reading_raw_score, reading_total_questions, level),
  writing_scaled_score = calculate_scaled_score(course_id, 'writing', writing_raw_score, writing_total_questions, level)
WHERE true;
