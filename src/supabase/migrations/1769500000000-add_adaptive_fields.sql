-- Add adaptive SAT fields to courses
ALTER TABLE courses ADD COLUMN is_adaptive BOOLEAN DEFAULT false;
ALTER TABLE courses ADD COLUMN threshold_percentage INTEGER DEFAULT 60;
