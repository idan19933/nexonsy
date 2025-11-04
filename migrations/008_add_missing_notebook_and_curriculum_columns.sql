-- 008_add_missing_notebook_and_curriculum_columns.sql
-- Add missing columns to notebook_entries and curriculum_progress

BEGIN;

-- Add missing columns to notebook_entries
ALTER TABLE notebook_entries 
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add missing column to curriculum_progress
ALTER TABLE curriculum_progress 
ADD COLUMN IF NOT EXISTS last_practiced TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

COMMIT;
