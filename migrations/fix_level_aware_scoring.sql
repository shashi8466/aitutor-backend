-- ==========================================================
-- FIX: Level-aware Scaled Score Calculation
-- ==========================================================

-- 1. Add level column to grade_scales if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grade_scales' AND column_name = 'level') THEN
        ALTER TABLE grade_scales ADD COLUMN level text;
    END IF;
END $$;

-- 2. Create index for level-aware queries
CREATE INDEX IF NOT EXISTS idx_grade_scales_level ON grade_scales(course_id, section, level);

-- 3. Replace calculate_scaled_score with level-aware logic
CREATE OR REPLACE FUNCTION calculate_scaled_score(
  p_course_id bigint,
  p_section text,
  p_raw_score integer,
  p_total_questions integer,
  p_level text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scale grade_scales%ROWTYPE;
  v_percentage numeric;
  v_scaled_score integer;
  v_course_name text;
  v_course_type text;
  v_min_score integer;
  v_max_score integer;
  v_normalized_level text;
BEGIN
  -- Normalize level (capitalize first letter, lowercase rest)
  -- Standardize to Medium if not provided or valid
  IF p_level IS NOT NULL AND LOWER(p_level) IN ('easy', 'medium', 'hard') THEN
    v_normalized_level := INITCAP(LOWER(p_level));
  ELSE
    v_normalized_level := 'Medium';
  END IF;
  
  -- Get the grade scale for this course, section AND level
  -- We prioritize level-specific scales first
  SELECT * INTO v_scale 
  FROM grade_scales 
  WHERE course_id = p_course_id 
    AND section = p_section 
    AND (level IS NULL OR level = v_normalized_level)
    AND is_active = true
  ORDER BY (level IS NOT NULL) DESC -- Prefer level-specific record
  LIMIT 1;
  
  -- Calculate percentage (0-1)
  IF p_total_questions = 0 OR p_total_questions IS NULL THEN
    -- Return minimum score if no questions
    IF v_scale.id IS NOT NULL THEN
      RETURN v_scale.min_scaled_score;
    ELSE
      -- Fallback minimums based on section
      IF p_section = 'overall' THEN
        RETURN 200; -- Change to 200 for single section courses
      ELSE
        RETURN 200;
      END IF;
    END IF;
  END IF;
  
  v_percentage := p_raw_score::numeric / p_total_questions::numeric;
  
  -- If scale found, use it
  IF v_scale.id IS NOT NULL THEN
    -- Apply linear scaling
    IF v_scale.scale_type = 'linear' THEN
      v_scaled_score := ROUND(
        v_scale.min_scaled_score + 
        (v_percentage * (v_scale.max_scaled_score - v_scale.min_scaled_score))
      );
      
      -- Ensure score is within bounds
      v_scaled_score := GREATEST(v_scale.min_scaled_score, LEAST(v_scale.max_scaled_score, v_scaled_score));
      
      RETURN v_scaled_score;
    END IF;
  END IF;
  
  -- FALLBACK: Calculate score using level-based SAT ranges when no scale exists
  -- Determine course category to use appropriate ranges
  SELECT name, tutor_type INTO v_course_name, v_course_type
  FROM courses
  WHERE id = p_course_id;
  
  -- Determine if MATH or RW based on course name/type
  v_course_name := COALESCE(LOWER(v_course_name), '');
  v_course_type := COALESCE(LOWER(v_course_type), '');
  
  -- Determine category (MATH or RW)
  -- Check for RW keywords first
  IF v_course_type LIKE '%reading%' OR v_course_type LIKE '%writing%' OR 
     v_course_type LIKE '%verbal%' OR v_course_type LIKE '%rw%' OR
     v_course_name LIKE '%english%' OR v_course_name LIKE '%reading%' OR 
     v_course_name LIKE '%writing%' OR v_course_name LIKE '%verbal%' OR 
     v_course_name LIKE '%grammar%' OR v_course_name LIKE '%r & d%' OR 
     v_course_name LIKE '%r&d%' OR v_course_name LIKE '%literacy%' THEN
    -- RW Category - use RW level ranges
    IF v_normalized_level = 'Easy' THEN
      v_min_score := 200;
      v_max_score := 500;
    ELSIF v_normalized_level = 'Hard' THEN
      v_min_score := 200;
      v_max_score := 800;
    ELSE -- Medium
      v_min_score := 200;
      v_max_score := 650;
    END IF;
  ELSE
    -- MATH Category - use MATH level ranges
    IF v_normalized_level = 'Easy' THEN
      v_min_score := 200;
      v_max_score := 500;
    ELSIF v_normalized_level = 'Hard' THEN
      v_min_score := 200;
      v_max_score := 800;
    ELSE -- Medium
      v_min_score := 200;
      v_max_score := 650;
    END IF;
  END IF;
  
  -- Special case for FULL tests if p_section is 'overall' and course is a full SAT?
  -- (Assuming single-subject courses for now since course list showed SAT MATH and SAT ENGLISH)
  -- If it's single subject, overall is 200-800.
  
  -- Calculate scaled score using linear formula: min + (percentage * (max - min))
  v_scaled_score := ROUND(v_min_score + (v_percentage * (v_max_score - v_min_score)));
  
  -- Ensure score is within bounds
  v_scaled_score := GREATEST(v_min_score, LEAST(v_max_score, v_scaled_score));
  
  RETURN v_scaled_score;
END;
$$;
