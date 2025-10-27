-- server/migrations/004_add_student_id_to_curriculum_progress.sql
-- Add student_id column to curriculum_progress table

ALTER TABLE curriculum_progress 
ADD COLUMN IF NOT EXISTS student_id VARCHAR(255);

-- Copy firebase_uid to student_id for existing rows
UPDATE curriculum_progress 
SET student_id = firebase_uid 
WHERE student_id IS NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_curriculum_progress_student_id ON curriculum_progress(student_id);

-- Create trigger to auto-populate student_id
DROP TRIGGER IF EXISTS set_curriculum_progress_student_id ON curriculum_progress;
CREATE TRIGGER set_curriculum_progress_student_id
    BEFORE INSERT OR UPDATE ON curriculum_progress
    FOR EACH ROW
    EXECUTE FUNCTION set_student_id();

COMMIT;
