-- 012_make_all_columns_nullable.sql
-- Comprehensive fix: Make all potentially problematic columns nullable

BEGIN;

-- Fix curriculum_progress table
ALTER TABLE curriculum_progress 
ALTER COLUMN topic_name DROP NOT NULL,
ALTER COLUMN subtopic_name DROP NOT NULL,
ALTER COLUMN topic_id DROP NOT NULL,
ALTER COLUMN subtopic_id DROP NOT NULL,
ALTER COLUMN grade_id DROP NOT NULL;

-- Fix notebook_entries table (just in case)
ALTER TABLE notebook_entries 
ALTER COLUMN user_answer DROP NOT NULL,
ALTER COLUMN correct_answer DROP NOT NULL;

COMMIT;
