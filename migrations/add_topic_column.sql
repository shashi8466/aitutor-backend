-- Add topic column to questions table if it doesn't exist
-- This allows us to store topics separately from question text

DO $$ 
BEGIN
    -- Check if the column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'questions' 
        AND column_name = 'topic'
    ) THEN
        ALTER TABLE questions ADD COLUMN topic TEXT;
        RAISE NOTICE 'Added topic column to questions table';
    ELSE
        RAISE NOTICE 'Topic column already exists';
    END IF;
END $$;

-- Add index for faster topic-based queries
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);

-- Display summary
SELECT 
    COUNT(*) as total_questions,
    COUNT(topic) as questions_with_topic,
    COUNT(*) - COUNT(topic) as questions_without_topic
FROM questions;
