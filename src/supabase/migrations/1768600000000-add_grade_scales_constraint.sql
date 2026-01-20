-- ==========================================================
-- ADD UNIQUE CONSTRAINT TO GRADE_SCALES
-- ==========================================================

ALTER TABLE grade_scales
ADD CONSTRAINT grade_scales_course_section_unique UNIQUE (course_id, section);
