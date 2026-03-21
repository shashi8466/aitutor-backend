-- ============================================
-- CHECK ENROLLMENT_KEYS TABLE STRUCTURE
-- Run this to see actual column names
-- ============================================

-- Get column information for enrollment_keys table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'enrollment_keys'
ORDER BY ordinal_position;

-- Show sample data (if any exists)
SELECT * FROM enrollment_keys LIMIT 5;
