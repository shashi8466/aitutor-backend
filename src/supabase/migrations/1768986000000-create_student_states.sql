/*
# Create Student States Table
Stores persistent state for the AI Tutor Agent, including:
- Goals
- Baseline scores
- Concept mastery
- Session logs
- Current agent state
*/

CREATE TABLE IF NOT EXISTS student_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  goal text,
  baseline jsonb DEFAULT '{}',
  mastery jsonb DEFAULT '{}',
  timing jsonb DEFAULT '{}',
  error_patterns jsonb DEFAULT '{}',
  preferences jsonb DEFAULT '{"difficulty": "Medium"}',
  session_log jsonb DEFAULT '[]',
  current_state text DEFAULT 'Start Session',
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE student_states ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own state" 
  ON student_states FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own state" 
  ON student_states FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own state" 
  ON student_states FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_student_states_user_id ON student_states(user_id);
