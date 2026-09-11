/*
# Per-role visibility for uploaded course materials

Adds `visible_to_student` / `visible_to_tutor` to `uploads` so each uploaded file (Study Guide,
Answer Key, etc.) can independently be shown or hidden to students vs tutors. Defaults to true
for both roles so every existing upload keeps its current (visible-to-everyone) behavior.

No new category constraint is needed - `uploads.category` is a free-form text column (no CHECK
constraint), so the new 'answer_key' category value (one course-wide answer key, level = 'All')
requires no schema change beyond these two columns.
*/

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'uploads' AND column_name = 'visible_to_student') THEN
        ALTER TABLE uploads ADD COLUMN visible_to_student boolean NOT NULL DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'uploads' AND column_name = 'visible_to_tutor') THEN
        ALTER TABLE uploads ADD COLUMN visible_to_tutor boolean NOT NULL DEFAULT true;
    END IF;
END $$;
