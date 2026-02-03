# Quick Fix Guide - Topic/Question Separation

## What You're Seeing Now ❌
Questions display like this:
```
Geometry & Trigonometry.Right triangles and trigonometry, In the figure shown...
```

## What You'll See After Fix ✅
Questions will display with a blue topic badge:
```
[Geometry & Trigonometry - Right triangles and trigonometry]  ← Blue badge
In the figure shown...                                         ← Clean question
```

---

## Step 1: Add Topic Column to Database

1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** (in the left sidebar)
4. Click **New Query**
5. Copy and paste this SQL:

```sql
-- Add topic column to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);

-- Check results
SELECT 
    COUNT(*) as total_questions,
    COUNT(topic) as questions_with_topic,
    COUNT(*) - COUNT(topic) as questions_without_topic
FROM questions;
```

6. Click **Run** (or press F5)
7. You should see a success message and a count of your questions

---

## Step 2: Run the Migration Script

Open a **NEW terminal** (don't close your dev server) and run:

```bash
node fix_existing_questions.js
```

You'll see output like:
```
🔌 Connected to Supabase: https://wqavuacgbawhgcdxxzom...
🔧 Starting to fix existing questions...

📊 Found 150 questions to process

✅ Question 1: Extracted topic "Geometry & Trigonometry"
✅ Question 2: Extracted topic "Craft and Structure"
...

📈 SUMMARY
Total Questions:  150
✅ Updated:       120
⏭️  Skipped:       25
❌ Errors:        0
```

---

## Step 3: Restart Your Dev Server

1. Go to the terminal running `npm run dev`
2. Press `Ctrl+C` to stop it
3. Run `npm run dev` again

---

## Step 4: Test in Browser

1. Refresh your browser
2. Go to any quiz
3. You should now see:
   - Blue topic badges at the top of questions
   - Clean question text without topic prefixes

---

## Troubleshooting

### "Module not found" error when running migration
Install the required package:
```bash
npm install dotenv
```

### Topics still not showing
1. Hard refresh your browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Check browser console for errors (F12)

### "Permission denied" error
Make sure your `.env` file has `SUPABASE_SERVICE_ROLE_KEY` set (it does!)

---

## Need Help?

If you encounter any issues:
1. Check the browser console (F12) for errors
2. Check the terminal output for error messages
3. Share the error message for assistance
