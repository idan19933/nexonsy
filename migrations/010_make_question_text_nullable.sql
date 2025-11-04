-- 010_make_question_text_nullable.sql
-- Make question_text nullable in notebook_entries

BEGIN;

-- Make question_text nullable
ALTER TABLE notebook_entries 
ALTER COLUMN question_text DROP NOT NULL;

COMMIT;
