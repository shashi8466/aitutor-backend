# Latest Attempt Score Display Fix

## Problem

Hemanth (and other students) were seeing **incorrect scores** on their dashboard that didn't match their actual latest test attempt scores. 

### Example Issue:
- **Latest Test Attempt**: 430 or 446 (actual scaled score from the test)
- **Dashboard Showing**: Different/old score (calculated aggregate from all attempts)

## Root Cause

The StudentDashboard was calculating course scores using an **aggregated SAT-style weighted average** across ALL test submissions:

```javascript
// OLD CODE - INCORRECT for displaying latest attempt
const levelScores = { Easy: 0, Medium: 0, Hard: 0 };

// Take BEST accuracy from each level across ALL submissions
courseSubmissions.forEach(sub => {
  const rawPct = Math.round(sub.raw_score_percentage || 0);
  if (rawPct > levelScores[lvl]) levelScores[lvl] = rawPct; // Takes HIGHEST
});

// Then calculate weighted SAT score
courseScaledScore = calculateSatScore(levelScores.Easy, levelScores.Medium, levelScores.Hard);
```

This meant the dashboard showed a **synthetic score** based on the student's best performance at each level, not their **most recent actual test score**.

## Solution

Updated the dashboard to **prioritize the LATEST test submission's actual scaled score**:

### New Logic Flow:

1. **Find Latest Submission**: Identify the most recent test attempt for each course
2. **Use Actual Scaled Score**: Display the `scaled_score` from that latest submission
3. **Fallback Calculation**: If no scaled_score exists, calculate from raw percentage
4. **Last Resort**: Only use aggregated progress data if no submissions exist

### Code Changes

**File:** `src/components/student/StudentDashboard.jsx`

```javascript
// Find the LATEST test submission for this course
let latestSubmission = null;
let latestTestDate = 0;

courseSubmissions.forEach(sub => {
  const testDate = new Date(sub.test_date || sub.created_at || 0).getTime();
  if (testDate > latestTestDate) {
    latestTestDate = testDate;
    latestSubmission = sub;
  }
});

// Use the LATEST submission's actual scaled score if available
let courseScaledScore = 0;
let isEstimated = false;

if (latestSubmission && latestSubmission.scaled_score) {
  // ✅ Use the ACTUAL scaled score from the latest test attempt
  courseScaledScore = latestSubmission.scaled_score;
  isEstimated = false;
} else if (latestSubmission && latestSubmission.raw_score_percentage !== undefined) {
  // Calculate from raw percentage if no scaled_score stored
  const levelName = latestSubmission.level 
    ? latestSubmission.level.charAt(0).toUpperCase() + latestSubmission.level.slice(1).toLowerCase()
    : 'Medium';
  courseScaledScore = calculateSessionScore(
    courseCategory,
    levelName,
    Math.round(latestSubmission.raw_score_percentage || 0)
  );
  isEstimated = false;
} else {
  // Fallback to aggregated level scores only if no submissions exist
  // ... (uses old aggregation logic as last resort)
  isEstimated = true;
}
```

## UI Improvements

### Enhanced Course Cards

Now displays:
- **"LATEST ATTEMPT"** label with actual score and test date
- **"ESTIMATED SCORE"** label when using fallback/aggregated data

```jsx
<span className="text-xs font-bold text-gray-400 block mb-0.5">
  {course.isEstimated ? 'ESTIMATED SCORE' : 'LATEST ATTEMPT'}
</span>
<span className={`text-lg font-black ${...}`}>
  {course.courseScaledScore}
</span>
{latestDate && !course.isEstimated && (
  <span className="text-[9px] font-bold text-gray-400 block mt-0.5">
    {latestDate}
  </span>
)}
```

## Impact

### Before Fix:
- ❌ Dashboard showed aggregated/calculated scores
- ❌ Latest attempt of 430 might show as 475 (inflated aggregate)
- ❌ No indication of when score was from
- ❌ Scores didn't match what students saw in their test results

### After Fix:
- ✅ Dashboard shows **EXACT** score from latest test attempt (e.g., 430 or 446)
- ✅ Clearly labeled as "LATEST ATTEMPT" with test date
- ✅ Matches the score shown in individual test result pages
- ✅ Falls back to estimated scores only when no test data exists

## Testing

### Verify the Fix:

1. **Check Hemanth's Dashboard**:
   - Navigate to Student Dashboard
   - Look at any course with recent test attempts
   - Verify it shows "LATEST ATTEMPT" with correct score

2. **Compare with Test Results**:
   - Go to Test Review page
   - Find the most recent test for a course
   - Confirm dashboard shows the same scaled score

3. **Check Date Display**:
   - Latest attempt date should appear below the score
   - Format: MM/DD/YYYY

4. **Verify Estimated Scores**:
   - Courses with no tests should show "ESTIMATED SCORE"
   - Based on diagnostic or progress data

## Database Consistency

This fix works in conjunction with the database migration that ensures `student_progress` stores **LATEST** scores instead of **GREATEST** scores:

- Migration file: `migrations/fix_score_consistency.sql`
- Updates `submit_and_grade_test()` function
- Ensures backend calculations align with frontend display

## Files Modified

1. ✅ `src/components/student/StudentDashboard.jsx` - Updated score calculation logic
2. ✅ Enhanced UI to show latest attempt date and labeling

## Notes

- No backend changes required - uses existing `scaled_score` field
- Backward compatible - falls back to old method if no submissions
- Performance impact: Minimal - just finding max date from existing array
- Data consistency: Works with existing test_submissions table structure
