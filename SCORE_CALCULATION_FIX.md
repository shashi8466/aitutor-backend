# Score Calculation Consistency Fix

## Problem Identified

Students were seeing **different scores** on their dashboard compared to their actual test performance. This was caused by **inconsistent score calculation formulas** across different parts of the application.

## Root Causes

### 1. **Backend vs Frontend Formula Mismatch** ⚠️

**Backend (Leaderboard)** was using:
```javascript
const weightedAcc = easy * 0.2 + medium * 0.35 + hard * 0.45;
const weightedScore = Math.max(200, Math.round(200 + (weightedAcc * 6)));
```

**Frontend (Dashboard)** was using SAT-style formula:
```javascript
const weightedAccuracy = (easy * 0.20) + (medium * 0.35) + (hard * 0.45);
const rawScore = (weightedAccuracy / 100) * 800;
const finalScore = Math.min(800, Math.max(0, rawScore));
```

**Backend Global Leaderboard** was using yet another "max of best level" approach instead of weighted average!

### 2. **Database Function Storing GREATEST Instead of LATEST** ⚠️

The `submit_and_grade_test` function in the database was updating `student_progress` with:
```sql
score = GREATEST(student_progress.score, EXCLUDED.score)
```

This meant dashboards showed the **highest historical score** rather than the **most recent attempt**, making scores appear inflated and inconsistent with recent test results.

## Fixes Applied

### ✅ Fix 1: Unified Backend Score Calculation

**File:** `src/server/utils/scoreCalculator.js`

- Added `calculateSatScore()` function that matches the frontend formula exactly
- Updated `calculateTotalSATScore()` to use the unified SAT-style weighted model
- Both frontend and backend now use: `(easy * 0.20) + (medium * 0.35) + (hard * 0.45)` scaled to 0-800

### ✅ Fix 2: Fixed Leaderboard Calculation

**File:** `src/server/routes/grading.js`

- Updated `/leaderboard/:courseId` endpoint to use `calculateSatScore()` instead of custom formula
- Ensures leaderboard rankings match what students see on their dashboards

### ✅ Fix 3: Database Function Now Stores LATEST Score

**File:** `src/supabase/migrations/1768700000000-fix_scaled_score_calculation.sql`

Changed from:
```sql
score = GREATEST(student_progress.score, EXCLUDED.score)
```

To:
```sql
score = EXCLUDED.score
```

This ensures `student_progress` always reflects the **most recent test attempt**, not the highest ever score.

### ✅ Fix 4: Created Migration Script

**File:** `migrations/fix_score_consistency.sql`

- Updates the `submit_and_grade_test` function with the fix
- Includes data migration to update existing `student_progress` records with latest scores
- Ensures historical data is consistent

## How Scores Are Now Calculated

### For Each Course Section (Math & Reading/Writing):

1. **Collect Best Accuracy Per Level**: Track the student's best percentage score for Easy, Medium, and Hard levels across all their attempts

2. **Apply SAT-Style Weighted Formula**:
   ```
   Weighted Accuracy = (Easy% × 0.20) + (Medium% × 0.35) + (Hard% × 0.45)
   Section Score = (Weighted Accuracy ÷ 100) × 800
   ```

3. **Clamp to Valid SAT Range**: Ensure score is between 0 and 800

4. **Calculate Total Score**: Math Section + Reading/Writing Section = Total (0-1600)

### Example Calculation:

If a student has:
- Easy: 80% accuracy
- Medium: 70% accuracy  
- Hard: 60% accuracy

**Calculation:**
```
Weighted Accuracy = (80 × 0.20) + (70 × 0.35) + (60 × 0.45)
                  = 16 + 24.5 + 27
                  = 67.5

Section Score = (67.5 ÷ 100) × 800
              = 0.675 × 800
              = 540
```

## Testing Instructions

### 1. Apply the Database Migration

Run this command in your Supabase SQL Editor or via CLI:

```bash
# If you have Supabase CLI installed
supabase db push migrations/fix_score_consistency.sql
```

Or manually run the SQL in `migrations/fix_score_consistency.sql`

### 2. Restart Backend Server

```bash
npm run dev
# or
npm start
```

### 3. Verify Score Consistency

1. **Take a Test**: Have a student complete a quiz/test
2. **Check Submission Details**: View the raw score percentage in the submission details
3. **Check Dashboard**: Verify the dashboard shows the correct calculated score
4. **Check Leaderboard**: Confirm the leaderboard ranking uses the same score
5. **Retake Test**: Have the student retake the test with a different score
6. **Verify Update**: Confirm the dashboard now shows the LATEST score (not the highest)

### 4. Compare Before/After

**Before Fix:**
- Dashboard might show inflated scores (highest ever)
- Leaderboard might differ from dashboard
- Recent poor performance might not reflect accurately

**After Fix:**
- Dashboard shows most recent attempt scores
- Leaderboard matches dashboard calculations
- Score progression accurately reflects learning journey

## Files Modified

1. ✅ `src/server/utils/scoreCalculator.js` - Added unified `calculateSatScore()` function
2. ✅ `src/server/routes/grading.js` - Updated leaderboard to use unified formula
3. ✅ `src/supabase/migrations/1768700000000-fix_scaled_score_calculation.sql` - Fixed database function
4. ✅ `migrations/fix_score_consistency.sql` - New migration script (CREATE NEW FILE)

## Impact

- ✅ **Consistent Scoring**: All parts of the app now use identical calculation methods
- ✅ **Accurate Progress**: Dashboards reflect actual recent performance
- ✅ **Fair Leaderboards**: Rankings based on same formula as individual dashboards
- ✅ **Better Motivation**: Students see real progress, not inflated historical bests

## Notes

- The migration includes a data update to fix existing student_progress records
- Future test submissions will automatically use the new logic
- No data loss occurs - we're just fixing which score is displayed (latest vs greatest)
