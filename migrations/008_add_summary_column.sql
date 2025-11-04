-- 008_add_summary_column.sql
-- Add missing summary column to notebook_entries

BEGIN;

ALTER TABLE notebook_entries 
ADD COLUMN IF NOT EXISTS summary TEXT;

COMMIT;
