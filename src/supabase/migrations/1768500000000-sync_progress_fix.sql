-- ==========================================================
-- FIX: SYNC TEST SUBMISSIONS TO STUDENT PROGRESS (60% Threshold)
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
  
  -- 3. Calculate final results
  v_raw_percentage := (v_raw_score::numeric / v_total_questions::numeric) * 100;
  v_scaled_score := calculate_scaled_score(p_course_id, 'overall', v_raw_score, v_total_questions);
  
  -- 4. Update the submission record with full analytics
  UPDATE test_submissions SET
    raw_score = v_raw_score,
    raw_score_percentage = v_raw_percentage,
    scaled_score = v_scaled_score,
    math_raw_score = v_math_correct,
    math_total_questions = v_math_total, 
    math_percentage = CASE WHEN v_math_total > 0 THEN (v_math_correct::numeric / v_math_total::numeric) * 100 ELSE 0 END,
    math_scaled_score = calculate_scaled_score(p_course_id, 'math', v_math_correct, v_math_total),
    reading_raw_score = v_reading_correct,
    reading_total_questions = v_reading_total,
    reading_percentage = CASE WHEN v_reading_total > 0 THEN (v_reading_correct::numeric / v_reading_total::numeric) * 100 ELSE 0 END,
    reading_scaled_score = calculate_scaled_score(p_course_id, 'reading', v_reading_correct, v_reading_total),
    writing_raw_score = v_writing_correct,
    writing_total_questions = v_writing_total,
    writing_percentage = CASE WHEN v_writing_total > 0 THEN (v_writing_correct::numeric / v_writing_total::numeric) * 100 ELSE 0 END,
    writing_scaled_score = calculate_scaled_score(p_course_id, 'writing', v_writing_correct, v_writing_total),
    correct_questions = v_correct_ids,
    incorrect_questions = v_incorrect_ids,
    updated_at = now()
  WHERE id = v_submission_id;

  -- 5. SYNC TO STUDENT_PROGRESS TABLE (40% THRESHOLD)
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
    (v_raw_percentage >= 40), -- Threshold lowered to 40
    now()
  )
  ON CONFLICT (user_id, course_id, level) 
  DO UPDATE SET 
    score = GREATEST(student_progress.score, EXCLUDED.score),
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
        'scaled_score', calculate_scaled_score(p_course_id, 'math', v_math_correct, v_math_total)
      ),
      'reading', jsonb_build_object(
        'correct', v_reading_correct,
        'total', v_reading_total,
        'percentage', CASE WHEN v_reading_total > 0 THEN (v_reading_correct::numeric / v_reading_total::numeric) * 100 ELSE 0 END,
        'scaled_score', calculate_scaled_score(p_course_id, 'reading', v_reading_correct, v_reading_total)
      ),
      'writing', jsonb_build_object(
        'correct', v_writing_correct,
        'total', v_writing_total,
        'percentage', CASE WHEN v_writing_total > 0 THEN (v_writing_correct::numeric / v_writing_total::numeric) * 100 ELSE 0 END,
        'scaled_score', calculate_scaled_score(p_course_id, 'writing', v_writing_correct, v_writing_total)
      )
    );
END;
$$;
