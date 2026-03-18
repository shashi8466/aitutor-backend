-- ==========================================================
-- FIX: Update calculate_scaled_score to use fallback when no grade scale exists
-- ==========================================================

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
  IF p_level IS NOT NULL THEN
    v_normalized_level := INITCAP(LOWER(p_level));
  ELSE
    v_normalized_level := 'Medium';
  END IF;
  
  -- Get the grade scale for this course and section
  SELECT * INTO v_scale 
  FROM grade_scales 
  WHERE course_id = p_course_id 
    AND section = p_section 
    AND is_active = true
  LIMIT 1;
  
  -- Calculate percentage (0-1)
  IF p_total_questions = 0 OR p_total_questions IS NULL THEN
    -- Return minimum score if no questions
    IF v_scale.id IS NOT NULL THEN
      RETURN v_scale.min_scaled_score;
    ELSE
      -- Fallback minimums based on section
      IF p_section = 'overall' THEN
        RETURN 400;
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
    IF p_section = 'overall' THEN
      -- For overall RW, use combined ranges
      IF v_normalized_level = 'Easy' THEN
        v_min_score := 400;
        v_max_score := 960;
      ELSIF v_normalized_level = 'Hard' THEN
        v_min_score := 1100;
        v_max_score := 1600;
      ELSE -- Medium
        v_min_score := 760;
        v_max_score := 1300;
      END IF;
    ELSE
      -- Individual RW sections (reading/writing)
      IF v_normalized_level = 'Easy' THEN
        v_min_score := 200;
        v_max_score := 480;
      ELSIF v_normalized_level = 'Hard' THEN
        v_min_score := 550;
        v_max_score := 800;
      ELSE -- Medium
        v_min_score := 380;
        v_max_score := 650;
      END IF;
    END IF;
  ELSE
    -- MATH Category - use MATH level ranges
    IF p_section = 'overall' THEN
      -- For overall MATH, use combined ranges
      IF v_normalized_level = 'Easy' THEN
        v_min_score := 400;
        v_max_score := 1000;
      ELSIF v_normalized_level = 'Hard' THEN
        v_min_score := 1100;
        v_max_score := 1600;
      ELSE -- Medium
        v_min_score := 800;
        v_max_score := 1300;
      END IF;
    ELSE
      -- MATH section
      IF v_normalized_level = 'Easy' THEN
        v_min_score := 200;
        v_max_score := 500;
      ELSIF v_normalized_level = 'Hard' THEN
        v_min_score := 550;
        v_max_score := 800;
      ELSE -- Medium
        v_min_score := 400;
        v_max_score := 650;
      END IF;
    END IF;
  END IF;
  
  -- Calculate scaled score using linear formula: min + (percentage * (max - min))
  v_scaled_score := ROUND(v_min_score + (v_percentage * (v_max_score - v_min_score)));
  
  -- Ensure score is within bounds
  v_scaled_score := GREATEST(v_min_score, LEAST(v_max_score, v_scaled_score));
  
  RETURN v_scaled_score;
END;
$$;

-- ==========================================================
-- Update submit_and_grade_test to pass level to calculate_scaled_score
-- ==========================================================

CREATE OR REPLACE FUNCTION submit_and_grade_test(
  p_user_id uuid,
  p_course_id bigint,
  p_level text,
  p_question_ids bigint[],
  p_answers text[],
  p_duration_seconds integer DEFAULT NULL
)
RETURNS TABLE (
  submission_id bigint,
  raw_score integer,
  raw_percentage numeric,
  scaled_score integer,
  section_scores jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_submission_id bigint;
  v_total_questions integer;
  v_raw_score integer := 0;
  v_raw_percentage numeric;
  v_scaled_score integer;
  
  v_math_correct integer := 0;
  v_math_total integer := 0;
  v_reading_correct integer := 0;
  v_reading_total integer := 0;
  v_writing_correct integer := 0;
  v_writing_total integer := 0;
  
  v_correct_ids bigint[] := '{}';
  v_incorrect_ids bigint[] := '{}';
  
  v_question record;
  v_answer text;
  v_index integer;
  v_is_correct boolean;
BEGIN
  v_total_questions := array_length(p_question_ids, 1);
  
  -- 1. Create the submission record first
  INSERT INTO test_submissions (
    user_id, course_id, level,
    test_duration_seconds, total_questions,
    raw_score, raw_score_percentage
  ) VALUES (
    p_user_id, p_course_id, p_level,
    p_duration_seconds, v_total_questions,
    0, 0
  ) RETURNING id INTO v_submission_id;

  -- 2. Grade each question and record responses
  FOR v_index IN 1..v_total_questions LOOP
    SELECT * INTO v_question 
    FROM questions 
    WHERE id = p_question_ids[v_index];
    
    v_answer := p_answers[v_index];
    v_is_correct := (v_answer = v_question.correct_answer);
    
    -- Record internal response
    INSERT INTO test_responses (submission_id, question_id, selected_answer, is_correct)
    VALUES (v_submission_id, v_question.id, v_answer, v_is_correct);

    IF v_is_correct THEN
      v_raw_score := v_raw_score + 1;
      v_correct_ids := array_append(v_correct_ids, v_question.id);
      
      -- Count by section
      CASE v_question.section
        WHEN 'math' THEN
          v_math_correct := v_math_correct + 1;
          v_math_total := v_math_total + 1;
        WHEN 'reading' THEN
          v_reading_correct := v_reading_correct + 1;
          v_reading_total := v_reading_total + 1;
        WHEN 'writing' THEN
          v_writing_correct := v_writing_correct + 1;
          v_writing_total := v_writing_total + 1;
        ELSE
          NULL;
      END CASE;
    ELSE
      v_incorrect_ids := array_append(v_incorrect_ids, v_question.id);
      
      CASE v_question.section
        WHEN 'math' THEN v_math_total := v_math_total + 1;
        WHEN 'reading' THEN v_reading_total := v_reading_total + 1;
        WHEN 'writing' THEN v_writing_total := v_writing_total + 1;
        ELSE NULL;
      END CASE;
    END IF;
  END LOOP;
  
  -- 3. Calculate final results (NOW PASSING LEVEL TO calculate_scaled_score)
  v_raw_percentage := (v_raw_score::numeric / v_total_questions::numeric) * 100;
  v_scaled_score := calculate_scaled_score(p_course_id, 'overall', v_raw_score, v_total_questions, p_level);
  
  -- 4. Update the submission record with full analytics
  UPDATE test_submissions SET
    raw_score = v_raw_score,
    raw_score_percentage = v_raw_percentage,
    scaled_score = v_scaled_score,
    math_raw_score = v_math_correct,
    math_total_questions = v_math_total, 
    math_percentage = CASE WHEN v_math_total > 0 THEN (v_math_correct::numeric / v_math_total::numeric) * 100 ELSE 0 END,
    math_scaled_score = calculate_scaled_score(p_course_id, 'math', v_math_correct, v_math_total, p_level),
    reading_raw_score = v_reading_correct,
    reading_total_questions = v_reading_total,
    reading_percentage = CASE WHEN v_reading_total > 0 THEN (v_reading_correct::numeric / v_reading_total::numeric) * 100 ELSE 0 END,
    reading_scaled_score = calculate_scaled_score(p_course_id, 'reading', v_reading_correct, v_reading_total, p_level),
    writing_raw_score = v_writing_correct,
    writing_total_questions = v_writing_total,
    writing_percentage = CASE WHEN v_writing_total > 0 THEN (v_writing_correct::numeric / v_writing_total::numeric) * 100 ELSE 0 END,
    writing_scaled_score = calculate_scaled_score(p_course_id, 'writing', v_writing_correct, v_writing_total, p_level),
    correct_questions = v_correct_ids,
    incorrect_questions = v_incorrect_ids,
    updated_at = now()
  WHERE id = v_submission_id;

  -- 5. SYNC TO STUDENT_PROGRESS TABLE (40% THRESHOLD)
  -- Store LATEST score, not GREATEST, to ensure dashboards show most recent performance
  INSERT INTO public.student_progress (
    user_id, 
    course_id, 
    level, 
    score, 
    passed, 
    created_at
  )
  VALUES (
    p_user_id, 
    p_course_id, 
    p_level, 
    v_raw_percentage, 
    (v_raw_percentage >= 40),
    now()
  )
  ON CONFLICT (user_id, course_id, level) 
  DO UPDATE SET 
    score = EXCLUDED.score,
    passed = (student_progress.passed OR EXCLUDED.passed),
    created_at = now();
  
  -- 6. Return summary
  RETURN QUERY
  SELECT 
    v_submission_id,
    v_raw_score,
    v_raw_percentage,
    v_scaled_score,
    jsonb_build_object(
      'math', jsonb_build_object(
        'correct', v_math_correct,
        'total', v_math_total,
        'percentage', CASE WHEN v_math_total > 0 THEN (v_math_correct::numeric / v_math_total::numeric) * 100 ELSE 0 END,
        'scaled_score', calculate_scaled_score(p_course_id, 'math', v_math_correct, v_math_total, p_level)
      ),
      'reading', jsonb_build_object(
        'correct', v_reading_correct,
        'total', v_reading_total,
        'percentage', CASE WHEN v_reading_total > 0 THEN (v_reading_correct::numeric / v_reading_total::numeric) * 100 ELSE 0 END,
        'scaled_score', calculate_scaled_score(p_course_id, 'reading', v_reading_correct, v_reading_total, p_level)
      ),
      'writing', jsonb_build_object(
        'correct', v_writing_correct,
        'total', v_writing_total,
        'percentage', CASE WHEN v_writing_total > 0 THEN (v_writing_correct::numeric / v_writing_total::numeric) * 100 ELSE 0 END,
        'scaled_score', calculate_scaled_score(p_course_id, 'writing', v_writing_correct, v_writing_total, p_level)
      )
    );
END;
$$;

-- ==========================================================
-- Update existing NULL scaled scores with calculated values (using level)
-- ==========================================================

UPDATE test_submissions 
SET 
  scaled_score = calculate_scaled_score(course_id, 'overall', raw_score, total_questions, level),
  math_scaled_score = calculate_scaled_score(course_id, 'math', math_raw_score, math_total_questions, level),
  reading_scaled_score = calculate_scaled_score(course_id, 'reading', reading_raw_score, reading_total_questions, level),
  writing_scaled_score = calculate_scaled_score(course_id, 'writing', writing_raw_score, writing_total_questions, level)
WHERE scaled_score IS NULL 
   OR math_scaled_score IS NULL 
   OR reading_scaled_score IS NULL 
   OR writing_scaled_score IS NULL;

