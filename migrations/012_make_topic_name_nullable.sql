-- 012_make_topic_name_nullable.sql
-- Make topic_name nullable in curriculum_progress

BEGIN;

-- Make topic_name nullable
ALTER TABLE curriculum_progress 
ALTER COLUMN topic_name DROP NOT NULL;

COMMIT;
