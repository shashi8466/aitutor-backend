/* 
# Create Student Progress Table
1. New Tables
   - `student_progress`
     - `id` (uuid, primary key)
     - `user_id` (uuid, references profiles)
     - `course_id` (bigint, references courses)
     - `level` (text) - 'Easy', 'Medium', 'Hard'
     - `score` (integer)
     - `passed` (boolean)
     - `created_at` (timestamp)

2. Security
   - Enable RLS
   - Policies for students to read/insert their own progress
*/

CREATE TABLE IF NOT EXISTS student_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  course_id bigint REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  level text NOT NULL,
  score integer DEFAULT 0,
  passed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, course_id, level) -- Prevent duplicate records for same level
);

ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own progress
CREATE POLICY "Users can view own progress" 
  ON student_progress 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Policy: Users can insert/update their own progress
CREATE POLICY "Users can update own progress" 
  ON student_progress 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can modify own progress" 
  ON student_progress 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);