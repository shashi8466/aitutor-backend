# Fix Existing Questions - Migration Guide

## Problem
Existing questions in the database have topics mixed with question text like:
- `Geometry & Trigonometry.Right triangles and trigonometry, In the figure shown...`
- `Craft and Structure, Words in Context Research by marine biologists...`

## Solution
This migration will:
1. Add a `topic` column to the questions table
2. Extract topics from existing question text
3. Store topics separately and clean the question text

## Steps to Run

### Step 1: Add Topic Column to Database

**Option A: Using Supabase Dashboard (Recommended)**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `migrations/add_topic_column.sql`
4. Click **Run**
5. Verify the column was added successfully

**Option B: Using psql or another SQL client**
```bash
psql -h your-db-host -U your-user -d your-database -f migrations/add_topic_column.sql
```

### Step 2: Run the Migration Script

Make sure you have the required environment variables set in your `.env` file:
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key  # Optional, for better permissions
```

Run the migration:
```bash
node fix_existing_questions.js
```

### Step 3: Verify the Results

The script will output:
- ✅ Questions that were successfully updated
- ⏭️ Questions that were skipped (already had topics or no topic found)
- ❌ Any errors encountered

Example output:
```
🔧 Starting to fix existing questions...

📊 Found 150 questions to process

✅ Question 1: Extracted topic "Geometry & Trigonometry"
   Original: Geometry & Trigonometry.Right triangles and trigonometry, In the figure...
   Cleaned:  Right triangles and trigonometry, In the figure...

✅ Question 2: Extracted topic "Craft and Structure"
   Original: Craft and Structure, Words in Context Research by marine biologists...
   Cleaned:  Words in Context Research by marine biologists...

...

📈 SUMMARY
============================================================
Total Questions:  150
✅ Updated:       120
⏭️  Skipped:       25
❌ Errors:        5
============================================================
```

### Step 4: Restart Your Application

After the migration completes successfully:
```bash
# Stop the dev server (Ctrl+C)
# Restart it
npm run dev
```

### Step 5: Verify in the UI

1. Navigate to a quiz in your application
2. Questions should now display with:
   - A blue topic badge at the top (if topic exists)
   - Clean question text below (without topic prefix)

## Troubleshooting

### "Column already exists" error
This is fine - it means the column was already added. Just run the migration script (Step 2).

### "Permission denied" error
Make sure you're using `SUPABASE_SERVICE_KEY` in your `.env` file, not just the anon key.

### Topics not showing after migration
1. Clear your browser cache
2. Restart the dev server
3. Check the browser console for errors

### Some questions still show mixed text
The migration only extracts topics that match the predefined SAT_TOPICS list. If a question has a custom topic format, it won't be extracted automatically. You can:
1. Add the topic to the SAT_TOPICS array in the migration script
2. Re-run the migration
3. Or manually edit those questions in the admin panel

## Rollback (if needed)

If something goes wrong, you can rollback by running this SQL:
```sql
-- Remove the topic column
ALTER TABLE questions DROP COLUMN IF EXISTS topic;

-- Remove the index
DROP INDEX IF EXISTS idx_questions_topic;
```

Note: This will lose the extracted topic data. Make sure to backup your database before running migrations.
