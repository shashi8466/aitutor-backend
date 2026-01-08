/* 
# Create Test Reviews Table

1. New Tables
   - `test_reviews`
     - `id` (uuid, primary key)
     - `user_id` (uuid, references profiles)
     - `test_data` (jsonb) - Stores original test information
     - `analysis` (jsonb) - Stores the AI analysis results
     - `score` (integer) - Overall test score
     - `created_at` (timestamp)

2. Security
   - Enable RLS
   - Students can read/write their own reviews
*/

CREATE TABLE IF NOT EXISTS test_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  test_data jsonb DEFAULT '{}',
  analysis jsonb DEFAULT '{}',
  score integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE test_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own test reviews"
  ON test_reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own test reviews"
  ON test_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own test reviews"
  ON test_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);