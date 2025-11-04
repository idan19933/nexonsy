-- 006_add_attempts_column.sql
-- Add missing attempts column to curriculum_progress

BEGIN;

-- Add attempts column if it doesn't exist
ALTER TABLE curriculum_progress 
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 1;

-- Add hints_used column if it doesn't exist
ALTER TABLE curriculum_progress 
ADD COLUMN IF NOT EXISTS hints_used INTEGER DEFAULT 0;

-- Add time_spent column if it doesn't exist
ALTER TABLE curriculum_progress 
ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0;

COMMIT;
