/*
  # Create Student Plans Table
  1. New Tables
    - `student_plans`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `diagnostic_data` (jsonb) - Stores initial scores/weaknesses
      - `generated_plan` (jsonb) - Stores the AI 12-week schedule
      - `predicted_score_range` (text)
      - `target_date` (date)
      - `created_at` (timestamp)
  2. Security
    - Enable RLS
    - Students can read/write their own plans
*/

CREATE TABLE IF NOT EXISTS student_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  diagnostic_data jsonb DEFAULT '{}',
  generated_plan jsonb DEFAULT '{}',
  predicted_score_range text,
  target_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE student_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plans"
  ON student_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plans"
  ON student_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
  ON student_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);