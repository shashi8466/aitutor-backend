-- Migration: Add passage column to questions table
-- This enables storing linked passages for ACT Reading, Science, English, etc.

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS passage TEXT DEFAULT NULL;

-- If you have a view or other dependencies, they might need refreshing.
