-- server/migrations/003_add_progress_tables.sql
-- Add topic_progress and subtopic_progress tables

-- Topic Progress Table
CREATE TABLE IF NOT EXISTS topic_progress (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(255) NOT NULL,
    topic_id VARCHAR(255) NOT NULL,
    mastery_level INTEGER DEFAULT 0,
    exercises_completed INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    last_practiced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, topic_id)
);

-- Subtopic Progress Table
CREATE TABLE IF NOT EXISTS subtopic_progress (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(255) NOT NULL,
    subtopic_id VARCHAR(255) NOT NULL,
    mastery_level INTEGER DEFAULT 0,
    exercises_completed INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    last_practiced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, subtopic_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_topic_progress_student ON topic_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_topic_progress_topic ON topic_progress(topic_id);
CREATE INDEX IF NOT EXISTS idx_subtopic_progress_student ON subtopic_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_subtopic_progress_subtopic ON subtopic_progress(subtopic_id);

-- Add triggers for updated_at (with DROP first to prevent errors)
DROP TRIGGER IF EXISTS update_topic_progress_updated_at ON topic_progress;
CREATE TRIGGER update_topic_progress_updated_at
    BEFORE UPDATE ON topic_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subtopic_progress_updated_at ON subtopic_progress;
CREATE TRIGGER update_subtopic_progress_updated_at
    BEFORE UPDATE ON subtopic_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;
