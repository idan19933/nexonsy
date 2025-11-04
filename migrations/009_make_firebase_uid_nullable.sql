-- 009_make_firebase_uid_nullable.sql
-- Make firebase_uid nullable in notebook_entries

BEGIN;

-- Make firebase_uid nullable
ALTER TABLE notebook_entries 
ALTER COLUMN firebase_uid DROP NOT NULL;

COMMIT;
