-- 007_add_correct_attempts.sql
-- Add missing correct_attempts column

BEGIN;

ALTER TABLE curriculum_progress 
ADD COLUMN IF NOT EXISTS correct_attempts INTEGER DEFAULT 0;

COMMIT;
