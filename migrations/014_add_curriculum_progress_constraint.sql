-- 014_add_curriculum_progress_constraint.sql
-- Add UNIQUE constraint that matches the ON CONFLICT clause

BEGIN;

-- Add UNIQUE constraint on (student_id, grade_id, topic_id, subtopic_id)
ALTER TABLE curriculum_progress 
ADD CONSTRAINT curriculum_progress_student_grade_topic_subtopic_key 
UNIQUE (student_id, grade_id, topic_id, subtopic_id);

COMMIT;
