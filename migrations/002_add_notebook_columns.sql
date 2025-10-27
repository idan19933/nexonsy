-- server/migrations/002_add_notebook_columns.sql
-- Add missing student_id and type columns to notebook_entries

-- Add columns if they don't exist
ALTER TABLE notebook_entries
    ADD COLUMN IF NOT EXISTS student_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS type VARCHAR(100);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notebook_student_id ON notebook_entries(student_id);
CREATE INDEX IF NOT EXISTS idx_notebook_type ON notebook_entries(type);

-- Copy firebase_uid to student_id for existing rows
UPDATE notebook_entries
SET student_id = firebase_uid
WHERE student_id IS NULL;

-- Create trigger to auto-populate student_id
CREATE OR REPLACE FUNCTION set_student_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.student_id IS NULL AND NEW.firebase_uid IS NOT NULL THEN
        NEW.student_id = NEW.firebase_uid;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_notebook_student_id ON notebook_entries;
CREATE TRIGGER set_notebook_student_id
    BEFORE INSERT OR UPDATE ON notebook_entries
                         FOR EACH ROW
                         EXECUTE FUNCTION set_student_id();

COMMIT;