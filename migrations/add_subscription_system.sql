-- Database Migration: Subscription and Content Management System

-- 1. Update profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';

-- 2. Create plan_settings table
CREATE TABLE IF NOT EXISTS plan_settings (
    plan_type TEXT PRIMARY KEY,
    max_questions_math INTEGER DEFAULT 250,
    max_questions_rw INTEGER DEFAULT 250,
    max_tests INTEGER DEFAULT 2,
    feature_ai_tutor BOOLEAN DEFAULT FALSE,
    feature_study_planner BOOLEAN DEFAULT FALSE,
    feature_weakness_drills BOOLEAN DEFAULT FALSE,
    feature_test_review BOOLEAN DEFAULT FALSE,
    feature_score_predictor BOOLEAN DEFAULT FALSE,
    feature_advanced_analytics BOOLEAN DEFAULT FALSE,
    feature_college_advisor BOOLEAN DEFAULT FALSE,
    feature_leaderboard BOOLEAN DEFAULT FALSE,
    feature_study_resources BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initialize default settings for Free and Premium
INSERT INTO plan_settings (
    plan_type, max_questions_math, max_questions_rw, max_tests, 
    feature_ai_tutor, feature_study_planner, feature_weakness_drills,
    feature_test_review, feature_score_predictor, feature_advanced_analytics,
    feature_college_advisor, feature_leaderboard, feature_study_resources
)
VALUES 
('free', 250, 250, 2, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('premium', 10000, 10000, 10, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (plan_type) DO UPDATE SET
    max_questions_math = EXCLUDED.max_questions_math,
    max_questions_rw = EXCLUDED.max_questions_rw,
    max_tests = EXCLUDED.max_tests,
    feature_ai_tutor = EXCLUDED.feature_ai_tutor,
    feature_study_planner = EXCLUDED.feature_study_planner,
    feature_weakness_drills = EXCLUDED.feature_weakness_drills,
    feature_test_review = EXCLUDED.feature_test_review,
    feature_score_predictor = EXCLUDED.feature_score_predictor,
    feature_advanced_analytics = EXCLUDED.feature_advanced_analytics,
    feature_college_advisor = EXCLUDED.feature_college_advisor,
    feature_leaderboard = EXCLUDED.feature_leaderboard,
    feature_study_resources = EXCLUDED.feature_study_resources;

-- 3. Create plan_content_access table
CREATE TABLE IF NOT EXISTS plan_content_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type TEXT NOT NULL, -- 'course', 'topic', 'test'
    content_id TEXT NOT NULL, -- UUID for course/test, Topic Name for topic
    plan_type TEXT NOT NULL, -- 'free', 'premium'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(content_type, content_id, plan_type)
);

-- 4. Enable RLS
ALTER TABLE plan_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_content_access ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read settings
CREATE POLICY "Allow authenticated read settings" ON plan_settings
FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to read content access
CREATE POLICY "Allow authenticated read content access" ON plan_content_access
FOR SELECT TO authenticated USING (true);

-- Allow admin full access
CREATE POLICY "Admin full access settings" ON plan_settings
FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access content access" ON plan_content_access
FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
