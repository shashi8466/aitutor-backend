# Quiz Topic/Question Separation Fix

## Problem
The quiz interface was displaying topic names concatenated with question text, causing messy displays like:
```
Geometry & Trigonometry.Right triangles and trigonometry, In the figure shown...
```

Instead of the clean format:
```
Topic: Geometry & Trigonometry - Area and volume
Question: The area of a rectangle is 2400 square centimeters...
```

## Root Cause
In both `parser.js` (server-side) and `clientParser.js` (client-side), when a topic was detected at the start of a line:

1. The topic was extracted from the line
2. The remaining text was treated as the question
3. **The topic was then prepended back to the question** with markdown formatting: `` `**Topic: ${detectedTopic}**\n\n${qText}` ``

This caused the topic to be displayed as part of the question text in the UI.

## Solution

### 1. Parser Changes (Server & Client)
**Files Modified:**
- `src/server/utils/parser.js` (lines 298-322)
- `src/utils/clientParser.js` (lines 150-174)

**Changes:**
- Added a new `topic` field to the question object
- Store the detected topic separately in `topic: detectedTopic || null`
- Removed the line that prepended topic to question text
- Added period (`.`) to the separator regex: `/^[,\s.:-]+/` to handle cases like "Topic.Question"

**Before:**
```javascript
if (detectedTopic) qText = `**Topic: ${detectedTopic}**\n\n${qText}`;

currentQuestion = {
  question: qText || line,
  options: [],
  correctAnswer: '',
  explanation: null,
  level: null
};
```

**After:**
```javascript
// Store topic separately, don't prepend it to question text
currentQuestion = {
  question: qText || line,
  topic: detectedTopic || null,  // ← New field
  options: [],
  correctAnswer: '',
  explanation: null,
  level: null
};
```

### 2. UI Changes
**File Modified:**
- `src/components/student/QuizInterface.jsx` (lines 480-488)

**Changes:**
Added a topic badge display above the question:

```jsx
{/* Topic Badge - Display if topic exists */}
{currentQuestion.topic && (
  <div className="mb-4">
    <span className="inline-block px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm font-bold rounded-lg border border-blue-100 dark:border-blue-900/30">
      {currentQuestion.topic}
    </span>
  </div>
)}
```

## Result
Now the quiz interface will display:
1. **Topic badge** (if present) - A styled blue badge showing the category/topic
2. **Question number** - The numbered circle indicator
3. **Question text** - Clean question text without topic prefix

This provides clear visual separation between the topic/category and the actual question content.

## Testing Recommendations
1. Upload a quiz document with topics like "Geometry & Trigonometry.Right triangles and trigonometry, Question text..."
2. Verify the topic appears as a separate badge
3. Verify the question text is clean and doesn't include the topic
4. Test with both server-side uploads and client-side parsing
5. Check dark mode appearance of the topic badge
