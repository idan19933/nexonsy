-- 011_make_curriculum_firebase_uid_nullable.sql
-- Make firebase_uid nullable in curriculum_progress

BEGIN;

-- Make firebase_uid nullable in curriculum_progress
ALTER TABLE curriculum_progress 
ALTER COLUMN firebase_uid DROP NOT NULL;

COMMIT;
