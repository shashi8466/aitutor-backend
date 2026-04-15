# Complete Testing Guide - Question Retrieval System

## Issues Fixed ✅

### Issue 1: Duplicate Questions - RESOLVED
**Root Cause**: Database query used `.orderBy('id', { ascending: false }).limit(N)` which ALWAYS returned the same questions (highest IDs).

**Solution**: 
- Removed `.orderBy()` and `.limit()` from database queries
- Fetch ALL matching questions
- Use Fisher-Yates shuffle for true randomization
- Each request now returns different questions

### Issue 2: Incorrect Question Count - RESOLVED  
**Root Cause**: Multiple places had default of 5, insufficient fetch pools.

**Solution**:
- All defaults changed to 10
- Fetch pool: ALL questions (no limit)
- Returns exactly requested count

### Issue 3: Repeated Quiz Output - RESOLVED
**Root Cause**: Same database query order + inadequate shuffling.

**Solution**:
- Fisher-Yates shuffle (superior to `sort(() => Math.random() - 0.5)`)
- Session-wide duplicate tracking with `Set`
- Auto-clears history when all questions exhausted

## How to Test

### Test 1: Verify Question Count
```
Request: "Give me 10 questions on Algebra"
Expected: Returns exactly 10 questions
Check: Count the questions returned
```

### Test 2: Verify No Duplicates in Single Response
```
Request: "Give me 10 questions on Algebra"
Expected: All 10 questions have different IDs
Check: Look at console log: "[KB Process] Returning question IDs: 1, 5, 8, ..."
       All IDs should be unique
```

### Test 3: Verify Different Questions on Repeat Requests
```
Request 1: "Give me 10 questions on Algebra"
Note the question IDs from console log

Request 2: "Give me 10 questions on Algebra"  
Expected: Different question IDs
Check: Compare IDs from Request 1 and Request 2
       They should be COMPLETELY different (or minimal overlap if pool is small)
```

### Test 4: Verify Session-Wide Duplicate Prevention
```
Request 1: "Give me 10 questions on Algebra"
Request 2: "Give me 10 questions on Algebra"
Request 3: "Give me 10 questions on Algebra"

Expected: 
- Each request returns 10 DIFFERENT questions
- Total of 30 unique questions shown (if available)
- Console shows: "Filtered to 10 unique questions (from X total)"
```

### Test 5: Test Long Topic Names
```
Request: "Give me 10 questions on Ratios, rates, proportional relationships, and units"
Expected: 
- Topic matched correctly
- Returns 10 questions
- No "No questions found" error
```

### Test 6: Test Default Count (No Number Specified)
```
Request: "Quiz me on Algebra"
Expected: Returns 10 questions (default)
```

### Test 7: Test Custom Count
```
Request: "I want 15 questions on Geometry"
Expected: Returns exactly 15 questions
```

## Console Logs to Watch

### Successful Topic Match
```
📝 [Topic Extract] Extracted: "algebra" from "Give me 10 questions on Algebra"
🔍 [KB Search] User Topic: "Algebra"
✅ [KB Match] Found: "Algebra" (Type: exact, Score: 100)
📊 [Prep365 KB] Requested count: 10
📥 [KB Filter] Fetching up to ALL questions for randomization
📊 [KB Filter] Exact match returned 45 questions
[KB Process] Found 45 total, 45 unique. Returning 10 (requested: 10)
[KB Process] Returning question IDs: 234, 156, 89, 412, 67, 298, 145, 321, 78, 203
✅ [Prep365 KB] Successfully validated: Returning 10 exact questions from: "Algebra"
```

### Second Request (Different Questions)
```
📝 [Topic Extract] Extracted: "algebra" from "Give me 10 questions on Algebra"
✅ [KB Match] Found: "Algebra" (Type: exact, Score: 100)
📊 [Prep365 KB] Requested count: 10
[KB Process] Found 45 total, 45 unique. Returning 10 (requested: 10)
[KB Process] Returning question IDs: 445, 12, 378, 91, 267, 189, 534, 76, 298, 412
✅ [KB_ONLY] Filtered to 10 unique questions (from 10 total)
```
**Note**: IDs should be DIFFERENT from first request!

### Duplicate Prevention Active
```
✅ [KB_ONLY] Filtered to 10 unique questions (from 15 total)
```
This means: System found 15 questions, 5 were already shown, returned 10 new ones.

### All Questions Exhausted
```
⚠️ [KB_ONLY] All 10 questions are duplicates. Clearing history and showing fresh.
```
This means: All questions in KB have been shown, history cleared, showing questions again.

## Key Changes Made

### 1. Database Query (prep365KB.js)
**BEFORE** ❌:
```javascript
const { data: questions, error } = await query
    .orderBy('id', { ascending: false })  // Always same order!
    .limit(actualFetchLimit);              // Limited pool
```

**AFTER** ✅:
```javascript
const { data: questions, error } = await query;  // Fetch ALL, no ordering
// Client-side Fisher-Yates shuffle for true randomness
```

### 2. Shuffle Algorithm
**BEFORE** ❌:
```javascript
const shuffled = [...questions].sort(() => Math.random() - 0.5);
// Biased shuffle, not truly random
```

**AFTER** ✅:
```javascript
// Fisher-Yates shuffle (proper randomization)
const shuffled = [...questions];
for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}
```

### 3. Session Duplicate Tracking
**BEFORE** ❌:
```javascript
// Scanned all messages every time (slow, unreliable)
messages.forEach(msg => {
    if (msg.questions) {
        msg.questions.forEach(q => existingIds.add(q.id));
    }
});
```

**AFTER** ✅:
```javascript
// Persistent Set across entire session
const [shownQuestionIds, setShownQuestionIds] = useState(new Set());

// Fast O(1) lookup
const newQuestions = questions.filter(q => !shownQuestionIds.has(q.id));

// Update tracking
newQuestions.forEach(q => shownQuestionIds.add(q.id));
```

### 4. Fetch Pool Size
**BEFORE** ❌:
```javascript
.limit(requestedCount)  // Only 10 questions, no variety
```

**AFTER** ✅:
```javascript
// No limit - fetch ALL matching questions
// Shuffle and return requested count
```

## Performance Considerations

### Question Pool Size
- **Small topics** (10-20 questions): Will cycle through quickly, auto-clears history
- **Medium topics** (50-100 questions): Good variety, 5-10 requests before repeat
- **Large topics** (200+ questions): Excellent variety, many requests before repeat

### Memory Usage
- Session tracks shown question IDs in a Set
- Each ID is a number (~8 bytes)
- 1000 questions = ~8KB memory (negligible)

### Database Load
- Fetches ALL matching questions once per request
- For most topics: 20-100 questions (fast)
- For very large topics: Could be 500+ (still fast with proper indexing)

## Troubleshooting

### Still Seeing Duplicates?
1. Check console logs for question IDs
2. Verify IDs are actually different between requests
3. If same IDs appear, check:
   - Is the topic matching correctly?
   - Are there enough questions in the database?
   - Is the shuffle working? (check IDs order changes)

### Wrong Question Count?
1. Check console: `📊 [Prep365 KB] Requested count: X`
2. Check console: `[KB Process] Returning X questions`
3. If count is wrong:
   - Verify user input extraction
   - Check database has enough questions
   - Look for errors in console

### "No Questions Found" Error?
1. Check console: `✅ [KB Match] Found: "topic"`
2. Check console: `📊 [KB Filter] Exact match returned X questions`
3. If showing 0:
   - Run `node diagnose_questions.js` to check database
   - Verify topic name matches database exactly
   - Check if questions exist for that topic/difficulty

## Verification Checklist

- [ ] Request 10 questions → Gets exactly 10
- [ ] Request same topic twice → Gets different questions
- [ ] All question IDs in response are unique
- [ ] Long topic names work correctly
- [ ] Default count is 10 (when no number specified)
- [ ] Custom counts work (5, 15, 20, etc.)
- [ ] No "No questions found" errors for existing topics
- [ ] Console shows different IDs for each request
- [ ] Session prevents duplicates across multiple requests
- [ ] Auto-clears history when all questions exhausted

## Success Criteria

✅ **PASS**: Two consecutive requests for same topic return <50% overlap in question IDs
✅ **PASS**: All questions in single response have unique IDs
✅ **PASS**: Requested count matches returned count (or fewer if KB exhausted)
✅ **PASS**: No duplicate questions shown in session until all exhausted
✅ **PASS**: Long topic names match and return questions
✅ **PASS**: Default count is 10, not 5

## Run Diagnostic Script

To verify database has questions:
```bash
node diagnose_questions.js
```

This will test:
- Exact topic match
- Partial topic match
- Word-based matching
- Available topics in database
