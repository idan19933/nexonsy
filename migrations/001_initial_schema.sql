-- server/migrations/001_initial_schema.sql
-- Nexon AI - Complete Database Schema
-- Run this to create all tables in Railway PostgreSQL

-- Drop existing tables if they exist (careful in production!)
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS notebook_entries CASCADE;
DROP TABLE IF EXISTS curriculum_progress CASCADE;
DROP TABLE IF EXISTS student_goals CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
                       id SERIAL PRIMARY KEY,
                       firebase_uid VARCHAR(255) UNIQUE NOT NULL,
                       email VARCHAR(255),
                       display_name VARCHAR(255),
                       grade VARCHAR(50),
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_email ON users(email);

-- =====================================================
-- NOTEBOOK ENTRIES TABLE
-- =====================================================
CREATE TABLE notebook_entries (
                                  id SERIAL PRIMARY KEY,
                                  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                                  firebase_uid VARCHAR(255) NOT NULL,
                                  student_id VARCHAR(255),
                                  topic VARCHAR(255) NOT NULL,
                                  subtopic VARCHAR(255),
                                  question_text TEXT NOT NULL,
                                  user_answer TEXT,
                                  correct_answer TEXT,
                                  explanation TEXT,
                                  is_correct BOOLEAN DEFAULT FALSE,
                                  difficulty VARCHAR(50),
                                  time_spent INTEGER DEFAULT 0,
                                  hints_used INTEGER DEFAULT 0,
                                  notes TEXT,
                                  tags TEXT[],
                                  type VARCHAR(100),
                                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notebook_firebase_uid ON notebook_entries(firebase_uid);
CREATE INDEX idx_notebook_student_id ON notebook_entries(student_id);
CREATE INDEX idx_notebook_topic ON notebook_entries(topic);
CREATE INDEX idx_notebook_type ON notebook_entries(type);
CREATE INDEX idx_notebook_created_at ON notebook_entries(created_at);

-- =====================================================
-- CHAT SESSIONS TABLE
-- =====================================================
CREATE TABLE chat_sessions (
                               id SERIAL PRIMARY KEY,
                               session_id VARCHAR(255) UNIQUE,
                               user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                               firebase_uid VARCHAR(255) NOT NULL,
                               topic VARCHAR(255),
                               subtopic VARCHAR(255),
                               difficulty VARCHAR(50),
                               personality VARCHAR(100),
                               started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                               ended_at TIMESTAMP,
                               total_questions INTEGER DEFAULT 0,
                               correct_answers INTEGER DEFAULT 0,
                               status VARCHAR(50) DEFAULT 'active',
                               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                               updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX idx_chat_sessions_firebase_uid ON chat_sessions(firebase_uid);
CREATE INDEX idx_chat_sessions_status ON chat_sessions(status);

-- =====================================================
-- CHAT MESSAGES TABLE
-- =====================================================
CREATE TABLE chat_messages (
                               id SERIAL PRIMARY KEY,
                               session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
                               firebase_uid VARCHAR(255) NOT NULL,
                               role VARCHAR(50) NOT NULL,
                               content TEXT NOT NULL,
                               question_data JSONB,
                               answer_data JSONB,
                               is_correct BOOLEAN,
                               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_firebase_uid ON chat_messages(firebase_uid);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- =====================================================
-- CURRICULUM PROGRESS TABLE
-- =====================================================
CREATE TABLE curriculum_progress (
                                     id SERIAL PRIMARY KEY,
                                     user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                                     firebase_uid VARCHAR(255) NOT NULL,
                                     topic_id VARCHAR(255) NOT NULL,
                                     topic_name VARCHAR(255) NOT NULL,
                                     subtopic_id VARCHAR(255),
                                     subtopic_name VARCHAR(255),
                                     total_questions INTEGER DEFAULT 0,
                                     correct_answers INTEGER DEFAULT 0,
                                     accuracy DECIMAL(5,2) DEFAULT 0,
                                     time_spent INTEGER DEFAULT 0,
                                     difficulty VARCHAR(50),
                                     last_practiced_at TIMESTAMP,
                                     mastery_level VARCHAR(50) DEFAULT 'beginner',
                                     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                     UNIQUE(firebase_uid, topic_id, subtopic_id)
);

CREATE INDEX idx_progress_firebase_uid ON curriculum_progress(firebase_uid);
CREATE INDEX idx_progress_topic_id ON curriculum_progress(topic_id);
CREATE INDEX idx_progress_mastery ON curriculum_progress(mastery_level);
CREATE INDEX idx_progress_last_practiced ON curriculum_progress(last_practiced_at);

-- =====================================================
-- STUDENT GOALS TABLE
-- =====================================================
CREATE TABLE student_goals (
                               id SERIAL PRIMARY KEY,
                               user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                               firebase_uid VARCHAR(255) NOT NULL,
                               goal_type VARCHAR(100) NOT NULL,
                               target_value INTEGER NOT NULL,
                               current_value INTEGER DEFAULT 0,
                               target_date DATE,
                               status VARCHAR(50) DEFAULT 'active',
                               description TEXT,
                               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                               updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                               completed_at TIMESTAMP
);

CREATE INDEX idx_goals_firebase_uid ON student_goals(firebase_uid);
CREATE INDEX idx_goals_status ON student_goals(status);
CREATE INDEX idx_goals_target_date ON student_goals(target_date);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notebook_updated_at
    BEFORE UPDATE ON notebook_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_progress_updated_at
    BEFORE UPDATE ON curriculum_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
    BEFORE UPDATE ON student_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-populate student_id from firebase_uid
CREATE OR REPLACE FUNCTION set_student_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.student_id IS NULL AND NEW.firebase_uid IS NOT NULL THEN
        NEW.student_id = NEW.firebase_uid;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_notebook_student_id
    BEFORE INSERT OR UPDATE ON notebook_entries
                         FOR EACH ROW
                         EXECUTE FUNCTION set_student_id();

-- =====================================================
-- SAMPLE DATA (Optional - Comment out for production)
-- =====================================================

-- Insert a test user
-- INSERT INTO users (firebase_uid, email, display_name, grade)
-- VALUES ('test_user_123', 'test@nexon.ai', 'Test Student', 'grade7');

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Show all tables
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Show table row counts
-- SELECT
--   'users' as table_name, COUNT(*) as row_count FROM users
-- UNION ALL SELECT 'notebook_entries', COUNT(*) FROM notebook_entries
-- UNION ALL SELECT 'chat_sessions', COUNT(*) FROM chat_sessions
-- UNION ALL SELECT 'chat_messages', COUNT(*) FROM chat_messages
-- UNION ALL SELECT 'curriculum_progress', COUNT(*) FROM curriculum_progress
-- UNION ALL SELECT 'student_goals', COUNT(*) FROM student_goals;

COMMIT;