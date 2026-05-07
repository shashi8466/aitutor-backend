-- Weakness Drill System Database Schema

-- Table for storing weakness analysis results
CREATE TABLE IF NOT EXISTS weakness_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES test_submissions(id) ON DELETE CASCADE,
    analysis_data JSONB NOT NULL,
    weaknesses_count INTEGER NOT NULL DEFAULT 0,
    strengths_count INTEGER NOT NULL DEFAULT 0,
    recommendations_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing generated weakness drills
CREATE TABLE IF NOT EXISTS weakness_drills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES test_submissions(id) ON DELETE CASCADE,
    drill_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    target_topic VARCHAR(255),
    target_difficulty VARCHAR(50),
    questions INTEGER[] NOT NULL,
    time_limit INTEGER NOT NULL,
    time_per_question INTEGER,
    difficulty VARCHAR(50) DEFAULT 'adaptive',
    question_count INTEGER NOT NULL,
    purpose TEXT,
    recommendations TEXT[],
    metadata JSONB,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    score INTEGER,
    time_spent INTEGER,
    responses JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_weakness_analysis_user_id ON weakness_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_weakness_analysis_course_id ON weakness_analysis(course_id);
CREATE INDEX IF NOT EXISTS idx_weakness_analysis_created_at ON weakness_analysis(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_weakness_drills_user_id ON weakness_drills(user_id);
CREATE INDEX IF NOT EXISTS idx_weakness_drills_course_id ON weakness_drills(course_id);
CREATE INDEX IF NOT EXISTS idx_weakness_drills_is_completed ON weakness_drills(is_completed);
CREATE INDEX IF NOT EXISTS idx_weakness_drills_created_at ON weakness_drills(created_at DESC);

-- Add RLS (Row Level Security) policies
ALTER TABLE weakness_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE weakness_drills ENABLE ROW LEVEL SECURITY;

-- Policy for weakness_analysis - users can only see their own analysis
CREATE POLICY "Users can view their own weakness analysis" ON weakness_analysis
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for weakness_drills - users can only see their own drills
CREATE POLICY "Users can view their own weakness drills" ON weakness_drills
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for inserting weakness_analysis
CREATE POLICY "Users can insert their own weakness analysis" ON weakness_analysis
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for inserting weakness_drills
CREATE POLICY "Users can insert their own weakness drills" ON weakness_drills
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for updating weakness_drills (for completion)
CREATE POLICY "Users can update their own weakness drills" ON weakness_drills
    FOR UPDATE USING (auth.uid() = user_id);

-- Updated trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_weakness_analysis_updated_at BEFORE UPDATE ON weakness_analysis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weakness_drills_updated_at BEFORE UPDATE ON weakness_drills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
