-- ============================================
-- Nexon Curriculum Progress Tracking Schema
-- ============================================

-- 1. Student Profiles
CREATE TABLE IF NOT EXISTS student_profiles (
                                                id SERIAL PRIMARY KEY,
                                                user_id INTEGER NOT NULL UNIQUE,
                                                grade VARCHAR(10) NOT NULL,
    track VARCHAR(50),
    cluster VARCHAR(100),
    school_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    math_attitude VARCHAR(50),
    confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
    goals TEXT[],
    weak_topics TEXT[],
    learning_style VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_student_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

-- 2. Topic Progress
CREATE TABLE IF NOT EXISTS topic_progress (
                                              id SERIAL PRIMARY KEY,
                                              user_id INTEGER NOT NULL,
                                              grade_id VARCHAR(20) NOT NULL,
    topic_id VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'not_started',
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    exercises_completed INTEGER DEFAULT 0,
    exercises_correct INTEGER DEFAULT 0,
    total_time_minutes INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_topic_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_topic UNIQUE(user_id, grade_id, topic_id)
    );

-- 3. Subtopic Progress
CREATE TABLE IF NOT EXISTS subtopic_progress (
                                                 id SERIAL PRIMARY KEY,
                                                 user_id INTEGER NOT NULL,
                                                 grade_id VARCHAR(20) NOT NULL,
    topic_id VARCHAR(50) NOT NULL,
    subtopic_id VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'not_started',
    mastery_level INTEGER DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 100),
    exercises_attempted INTEGER DEFAULT 0,
    exercises_correct INTEGER DEFAULT 0,
    hints_used INTEGER DEFAULT 0,
    average_time_seconds INTEGER DEFAULT 0,
    theory_viewed BOOLEAN DEFAULT FALSE,
    theory_view_count INTEGER DEFAULT 0,
    last_theory_view TIMESTAMP,
    first_attempt TIMESTAMP,
    last_practice TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_subtopic_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_subtopic UNIQUE(user_id, grade_id, topic_id, subtopic_id)
    );

-- 4. Learning Sessions
CREATE TABLE IF NOT EXISTS learning_sessions (
                                                 id SERIAL PRIMARY KEY,
                                                 user_id INTEGER NOT NULL,
                                                 grade_id VARCHAR(20),
    topic_id VARCHAR(50),
    subtopic_id VARCHAR(50),
    session_type VARCHAR(30),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration_minutes INTEGER,
    exercises_done INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0,
    mood_before VARCHAR(20),
    mood_after VARCHAR(20),
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

-- 5. Timeline Events
CREATE TABLE IF NOT EXISTS timeline_events (
                                               id SERIAL PRIMARY KEY,
                                               user_id INTEGER NOT NULL,
                                               event_type VARCHAR(30) NOT NULL,
    grade_id VARCHAR(20),
    topic_id VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    color VARCHAR(20),
    scheduled_date DATE,
    completed_date DATE,
    is_milestone BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_event_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

-- 6. Student Goals
CREATE TABLE IF NOT EXISTS student_goals (
                                             id SERIAL PRIMARY KEY,
                                             user_id INTEGER NOT NULL,
                                             goal_type VARCHAR(30),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE,
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    status VARCHAR(30) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    CONSTRAINT fk_goal_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_student_profiles_user ON student_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_grade ON student_profiles(grade);
CREATE INDEX IF NOT EXISTS idx_topic_progress_user ON topic_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_progress_grade ON topic_progress(grade_id);
CREATE INDEX IF NOT EXISTS idx_topic_progress_status ON topic_progress(status);
CREATE INDEX IF NOT EXISTS idx_topic_progress_user_grade ON topic_progress(user_id, grade_id);
CREATE INDEX IF NOT EXISTS idx_subtopic_progress_user ON subtopic_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_subtopic_progress_topic ON subtopic_progress(topic_id);
CREATE INDEX IF NOT EXISTS idx_subtopic_progress_user_topic ON subtopic_progress(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON learning_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON learning_sessions(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_timeline_user ON timeline_events(user_id);
CREATE INDEX IF NOT EXISTS idx_timeline_scheduled ON timeline_events(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_timeline_user_scheduled ON timeline_events(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_goals_user ON student_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON student_goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON student_goals(user_id, status);

-- ============================================
-- Triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_student_profiles_updated_at ON student_profiles;
CREATE TRIGGER update_student_profiles_updated_at
    BEFORE UPDATE ON student_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Views
-- ============================================

CREATE OR REPLACE VIEW student_progress_summary AS
SELECT
    sp.user_id,
    sp.grade,
    sp.track,
    COUNT(tp.id) as total_topics,
    COUNT(CASE WHEN tp.status = 'completed' THEN 1 END) as completed_topics,
    COUNT(CASE WHEN tp.status = 'in_progress' THEN 1 END) as in_progress_topics,
    ROUND(AVG(tp.progress_percent)) as avg_progress_percent,
    SUM(tp.exercises_completed) as total_exercises,
    SUM(tp.exercises_correct) as total_correct,
    SUM(tp.total_time_minutes) as total_time_minutes,
    CASE
        WHEN SUM(tp.exercises_completed) > 0
            THEN ROUND((SUM(tp.exercises_correct)::DECIMAL / SUM(tp.exercises_completed)) * 100)
        ELSE 0
        END as success_rate
FROM student_profiles sp
         LEFT JOIN topic_progress tp ON tp.user_id = sp.user_id
GROUP BY sp.user_id, sp.grade, sp.track;

CREATE OR REPLACE VIEW recent_student_activity AS
SELECT
    user_id,
    grade_id,
    topic_id,
    last_activity,
    status,
    progress_percent,
    exercises_completed
FROM topic_progress
WHERE last_activity IS NOT NULL
ORDER BY last_activity DESC;