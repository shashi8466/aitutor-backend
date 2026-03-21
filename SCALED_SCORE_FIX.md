# Scaled Score Calculation Fix

## Problem
The scaled score was stuck at 200 and not updating based on quiz performance. This was caused by:

1. **Database Function Issue**: The `calculate_scaled_score` function returned `NULL` when no grade scale was configured for a course/section
2. **Missing Level Parameter**: The function didn't use level-based scoring ranges (Easy/Medium/Hard) when no grade scale existed
3. **Frontend Fallback**: The frontend had a simple fallback that always defaulted to 200 when the API returned null

## Solution

### 1. Updated `calculate_scaled_score` Function
- Added optional `p_level` parameter (defaults to 'Medium' if not provided)
- Added intelligent fallback calculation when no grade scale exists
- Uses level-based scoring ranges matching the frontend logic:
  - **MATH**: Easy (200-500), Medium (400-650), Hard (550-800)
  - **RW**: Easy (200-480), Medium (380-650), Hard (550-800)
- Determines course category (MATH vs RW) based on course name/type
- Always returns a valid score (never NULL)

### 2. Updated `submit_and_grade_test` Function
- Now passes the `level` parameter to all `calculate_scaled_score` calls
- Ensures scaled scores are calculated using the correct level-based ranges
- Updates all section scores (math, reading, writing) with level-aware calculations

### 3. Frontend Improvements
- Updated `QuizInterface.jsx` to better handle scaled scores from API
- Added validation to ensure scaled score is greater than 0 before using it
- Improved fallback calculation (though backend should always provide valid scores now)

## Migration File
`src/supabase/migrations/1768700000000-fix_scaled_score_calculation.sql`

This migration:
1. Updates the `calculate_scaled_score` function with level-based fallback
2. Updates the `submit_and_grade_test` function to pass level parameter
3. Retroactively fixes existing NULL scaled scores in the database

## How to Apply

1. **Run the migration**:
   ```bash
   # Apply the migration to your Supabase database
   # The migration file is: src/supabase/migrations/1768700000000-fix_scaled_score_calculation.sql
   ```

2. **Verify the fix**:
   - Take a quiz and check that the scaled score updates correctly
   - Check the dashboard to ensure scores are displayed properly
   - Verify that scores vary based on Easy/Medium/Hard performance

## Testing Checklist

- [ ] Quiz submission calculates scaled score correctly
- [ ] Scaled score updates when accuracy changes
- [ ] Different levels (Easy/Medium/Hard) produce different score ranges
- [ ] Dashboard displays correct scaled scores
- [ ] Database stores scaled scores properly (not NULL)
- [ ] Existing NULL scores are retroactively fixed

## Notes

- The function signature change is backward compatible (level parameter has a default)
- Old calls to `calculate_scaled_score` without level will still work (defaults to 'Medium')
- Grade scales in the `grade_scales` table take precedence over fallback calculations
- If a grade scale exists, it will be used instead of the level-based fallback


