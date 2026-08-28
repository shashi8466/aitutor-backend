-- ==========================================================
-- FIX: submit_and_grade_test doesn't recognize " OR " as an accepted-answer
-- separator, so its persisted is_correct disagrees with the quiz-time grading
-- ==========================================================
-- Symptom: at submission time the student sees "Correct" (the exam UI grades
-- client-side using src/utils/answerGrading.js, which treats " OR " as a
-- separator between equivalent accepted answers - e.g. correct_answer
-- "11/28 or 0.39" accepts either "11/28" or "0.39"). But the report later
-- shows the SAME question as Incorrect, because the report reads the
-- is_correct value that was persisted to test_responses at submission time by
-- this Postgres function - and this function's comparison only ever split
-- correct_answer on comma/pipe, never on the word " or ". Verified directly
-- against production: test_responses rows for these questions have
-- is_correct = false even though selected_answer exactly equals one of the
-- two values listed in correct_answer (e.g. selected_answer '0.39' against
-- correct_answer '11/28 or 0.39').
--
-- This is not a report re-grading bug - the report already just displays the
-- persisted grading result. The bug is that the persisted result itself was
-- computed with an incomplete comparison rule. This migration brings this
-- function's accepted-answer splitting in line with the exact separator
-- already used by src/utils/answerGrading.js's VALUE_SEPARATOR
-- (/[,|]|\s+or\s+/i - comma, pipe, or the standalone word "or", case-
-- insensitive) for the primary comma/pipe/JSON-array check. It does NOT add
-- numeric/fraction equivalence (e.g. matching "7/2" against "3.5" when
-- neither is the literal listed string) - that's not what's reported broken
-- here, and every one of the reported examples is an exact-string match once
-- the answer is correctly split, so this is the complete, precise fix for
-- the actual bug rather than an unrequested rewrite of the grading rules.
--
-- Every other part of this function - score calculation, section/level
-- aggregation, student_progress sync, the JSON-array-answer fallback, the
-- 5% passing threshold, and the test_responses insert re-asserted in the
-- prior migration (1787838009578) - is completely unchanged.
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
    -- Support multiple accepted answers: comma-separated, pipe-separated, or
    -- joined with the standalone word "or" (case-insensitive) - e.g.
    -- "11/28 or 0.39" accepts either "11/28" or "0.39". This must match
    -- src/utils/answerGrading.js's VALUE_SEPARATOR exactly.
    v_is_correct := EXISTS (
      SELECT 1 FROM unnest(regexp_split_to_array(COALESCE(v_question.correct_answer, ''), '(,|\||\s+or\s+)', 'i')) a
      WHERE LOWER(TRIM(a)) = LOWER(TRIM(COALESCE(v_answer, '')))
    );

    -- If it looks like a JSON array, try parsing it as JSON safely inside a nested block
    IF NOT v_is_correct AND COALESCE(v_question.correct_answer, '') ~ '^\s*\[.*\]\s*$' THEN
      BEGIN
        v_is_correct := EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(v_question.correct_answer::jsonb) val
          WHERE LOWER(TRIM(val)) = LOWER(TRIM(COALESCE(v_answer, '')))
        );
      EXCEPTION WHEN OTHERS THEN
        -- Safely ignore malformed JSON strings like "[IMAGE: ...]"
        NULL;
      END;
    END IF;

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

  -- 5. SYNC TO STUDENT_PROGRESS TABLE (5% THRESHOLD)
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
    (v_raw_percentage >= 5),
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
