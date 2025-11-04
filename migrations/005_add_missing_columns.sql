-- server/migrations/005_add_missing_columns.sql
-- Add missing title and grade_id columns

-- Add title column to notebook_entries (optional)
ALTER TABLE notebook_entries 
ADD COLUMN IF NOT EXISTS title VARCHAR(500);

-- Add grade_id column to curriculum_progress
ALTER TABLE curriculum_progress 
ADD COLUMN IF NOT EXISTS grade_id VARCHAR(50);

-- Set default grade_id for existing rows
UPDATE curriculum_progress 
SET grade_id = 'grade_8' 
WHERE grade_id IS NULL;

COMMIT;
