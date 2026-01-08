/* 
      # Add Leaderboard RPCs (Remote Procedure Calls)
      
      1. New Functions
         - `get_course_leaderboard(target_course_id)`: 
           Calculates SAT-style scores (400-1600) for a specific course.
           Formula: 400 + (Sum of Level Percentages * 4).
           Max Score: 1600.
           
         - `get_global_leaderboard()`: 
           Calculates total XP (sum of all percentages) across all courses.
           
      2. Security
         - SECURITY DEFINER: Allows students to view rankings without direct access to other students' raw progress rows.
    */

    -- 1. Course Specific Leaderboard (SAT Score)
    CREATE OR REPLACE FUNCTION get_course_leaderboard(target_course_id bigint)
    RETURNS TABLE (
      user_id uuid,
      name text,
      score integer,
      levels_completed bigint
    ) 
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        p.id as user_id,
        p.name,
        -- Formula: 400 + (SUM(sp.score) * 4). 
        -- Example: 3 levels * 100% = 300. 300 * 4 = 1200. 400 + 1200 = 1600.
        -- We cap it at 1600 to be safe.
        LEAST(1600, CAST(400 + (COALESCE(SUM(sp.score), 0) * 4) AS INTEGER)) as score,
        COUNT(sp.id) as levels_completed
      FROM profiles p
      JOIN student_progress sp ON p.id = sp.user_id
      WHERE sp.course_id = target_course_id
      GROUP BY p.id, p.name
      ORDER BY score DESC
      LIMIT 50;
    END;
    $$ LANGUAGE plpgsql;

    -- 2. Global Leaderboard (Total Points/XP)
    CREATE OR REPLACE FUNCTION get_global_leaderboard()
    RETURNS TABLE (
      user_id uuid,
      name text,
      total_points bigint,
      levels_completed bigint
    )
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        p.id as user_id,
        p.name,
        COALESCE(SUM(sp.score), 0) as total_points,
        COUNT(sp.id) as levels_completed
      FROM profiles p
      LEFT JOIN student_progress sp ON p.id = sp.user_id
      WHERE p.role = 'student'
      GROUP BY p.id, p.name
      ORDER BY total_points DESC NULLS LAST
      LIMIT 50;
    END;
    $$ LANGUAGE plpgsql;

    -- Grant access
    GRANT EXECUTE ON FUNCTION get_course_leaderboard(bigint) TO authenticated;
    GRANT EXECUTE ON FUNCTION get_global_leaderboard() TO authenticated;