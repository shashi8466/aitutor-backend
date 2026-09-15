-- ==========================================================
-- FIX: Regular Course Easy/Medium/Hard reports show every level's scaled
-- score against a hard-coded "/ 800" in the UI, even though this app's own
-- existing scoring engine (calculate_scaled_score) deliberately gives each
-- level a different ceiling: Easy 200-500, Medium 200-650, Hard 200-800 (see
-- migrations/fix_level_aware_scoring.sql). That per-level cap is the
-- established scoring rule and is NOT being changed here - e.g. Easy: 73/75
-- correct (97%) -> 492 is CORRECT under a 200-500 band, and Medium: 51/51
-- (100%) -> 650 is CORRECT under a 200-650 band. The bug is purely that the
-- report always labels every card "/ 800", which is only true for Hard.
--
-- Fix: give the report the actual ceiling calculate_scaled_score used, so it
-- can display "492 / 500", "650 / 650", "776 / 800" instead of a misleading
-- constant. Rather than duplicating calculate_scaled_score's band-selection
-- logic (grade_scales lookup, per-course/section fallback bands) in a second
-- function, we call the EXACT SAME function again with a raw score equal to
-- the total question count - at 100% accuracy calculate_scaled_score already
-- returns exactly that ceiling, using its own existing, unmodified logic.
-- This guarantees the max can never drift from whatever the real scoring
-- engine would produce, without introducing any new scoring formula.
--
-- Full-Length Test scoring is untouched: full-length (SAT linear/adaptive)
-- submissions never call submit_and_grade_test at all (a separate insert
-- path - see grading.js), and full-length ACT submissions that do pass
-- through it have their scaled_score overwritten afterwards by the real ACT
-- composite tables and never read max_scaled_score in any report.
-- ==========================================================

-- 1. New column to hold each attempt's actual scoring ceiling.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_submissions' AND column_name = 'max_scaled_score') THEN
    ALTER TABLE test_submissions ADD COLUMN max_scaled_score integer;
  END IF;
END $$;

-- 2. submit_and_grade_test: identical to the live version (1787909185341,
-- OR-separator fix) except for the addition of v_max_scaled_score. Score
-- calculation, section/level aggregation, student_progress sync, the
-- JSON-array-answer fallback, the 5% passing threshold, and the
-- test_responses insert are completely unchanged.
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
  v_max_scaled_score integer;

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
    v_is_correct := EXISTS (
      SELECT 1 FROM unnest(regexp_split_to_array(COALESCE(v_question.correct_answer, ''), '(,|\||\s+or\s+)', 'i')) a
      WHERE LOWER(TRIM(a)) = LOWER(TRIM(COALESCE(v_answer, '')))
    );

    IF NOT v_is_correct AND COALESCE(v_question.correct_answer, '') ~ '^\s*\[.*\]\s*$' THEN
      BEGIN
        v_is_correct := EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(v_question.correct_answer::jsonb) val
          WHERE LOWER(TRIM(val)) = LOWER(TRIM(COALESCE(v_answer, '')))
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    INSERT INTO test_responses (submission_id, question_id, selected_answer, is_correct)
    VALUES (v_submission_id, v_question.id, v_answer, v_is_correct);

    IF v_is_correct THEN
      v_raw_score := v_raw_score + 1;
      v_correct_ids := array_append(v_correct_ids, v_question.id);

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
  -- The ceiling for this attempt: what calculate_scaled_score itself would return at 100%
  -- accuracy, using the exact same grade_scales/fallback lookup it already performed above.
  v_max_scaled_score := calculate_scaled_score(p_course_id, 'overall', v_total_questions, v_total_questions, p_level);

  -- 4. Update the submission record with full analytics
  UPDATE test_submissions SET
    raw_score = v_raw_score,
    raw_score_percentage = v_raw_percentage,
    scaled_score = v_scaled_score,
    max_scaled_score = v_max_scaled_score,
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

-- 3. Backfill existing Regular Course attempts (level = easy/medium/hard only -
-- full-length rows use level='Adaptive' and are never touched). Recomputes
-- raw_score/total_questions/raw_score_percentage/scaled_score/max_scaled_score
-- from the student's actual stored test_responses using the same
-- calculate_scaled_score engine, so old attempts stop showing whatever a
-- prior, now-superseded version of the scoring function produced. Does NOT
-- touch test_responses (the actual submitted answers) at all.
DO $$
DECLARE
  r RECORD;
  v_raw integer;
  v_total integer;
  v_pct numeric;
  v_scaled integer;
  v_max integer;
BEGIN
  FOR r IN
    SELECT id, course_id, level
    FROM test_submissions
    WHERE course_id IS NOT NULL AND LOWER(level) IN ('easy', 'medium', 'hard')
  LOOP
    SELECT
      COUNT(*) FILTER (WHERE is_correct) ,
      COUNT(*)
    INTO v_raw, v_total
    FROM test_responses
    WHERE submission_id = r.id;

    IF v_total > 0 THEN
      v_pct := (v_raw::numeric / v_total::numeric) * 100;
      v_scaled := calculate_scaled_score(r.course_id, 'overall', v_raw, v_total, r.level);
      v_max := calculate_scaled_score(r.course_id, 'overall', v_total, v_total, r.level);

      UPDATE test_submissions
      SET raw_score = v_raw,
          total_questions = v_total,
          raw_score_percentage = v_pct,
          scaled_score = v_scaled,
          max_scaled_score = v_max,
          updated_at = now()
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
