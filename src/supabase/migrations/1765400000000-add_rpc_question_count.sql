/*
# Add RPC for Question Count

1. New Functions
   - `increment_questions_count`: A stored procedure to safely increment the `questions_count` on the `courses` table. This avoids race conditions and keeps the logic in the database.

2. Security
   - The function is defined to run with the permissions of the caller. It will be called by an admin-authenticated user who already has update rights on the `courses` table, so this is secure.
*/

CREATE OR REPLACE FUNCTION increment_questions_count(course_id_in bigint, increment_amount integer)
RETURNS void AS $$
BEGIN
  UPDATE courses
  SET questions_count = questions_count + increment_amount
  WHERE id = course_id_in;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users. RLS on the `courses` table for the 'update'
-- operation will be checked, and since admins have this right, the function will succeed for them.
GRANT EXECUTE ON FUNCTION increment_questions_count(bigint, integer) TO authenticated;