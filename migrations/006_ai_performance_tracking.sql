-- server/migrations/006_ai_performance_tracking.sql
-- Add AI performance analysis and live statistics tracking
-- FIXED: Made idempotent (safe to run multiple times)

-- =====================================================
-- AI PERFORMANCE ANALYSIS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_performance_analysis (
                                                       id SERIAL PRIMARY KEY,
                                                       user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    firebase_uid VARCHAR(255) NOT NULL,
    recommended_difficulty VARCHAR(50) DEFAULT 'medium',
    weak_topics JSONB,
    feedback TEXT,
    metrics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_ai_analysis_firebase_uid ON ai_performance_analysis(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_created_at ON ai_performance_analysis(created_at DESC);

-- =====================================================
-- LEARNING SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS learning_sessions (
                                                 id SERIAL PRIMARY KEY,
                                                 user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    firebase_uid VARCHAR(255) NOT NULL,
    duration_minutes INTEGER,
    questions_attempted INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    topics_covered JSONB,
    avg_time_per_question FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_learning_sessions_firebase_uid ON learning_sessions(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_created_at ON learning_sessions(created_at DESC);

-- =====================================================
-- ADD COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add difficulty tracking to curriculum_progress
ALTER TABLE curriculum_progress
    ADD COLUMN IF NOT EXISTS difficulty VARCHAR(50) DEFAULT 'medium';

-- Add hints_used to curriculum_progress if not exists
ALTER TABLE curriculum_progress
    ADD COLUMN IF NOT EXISTS hints_used INTEGER DEFAULT 0;

-- Add attempts column to curriculum_progress
ALTER TABLE curriculum_progress
    ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;

-- Add performance metrics to notebook_entries
ALTER TABLE notebook_entries
    ADD COLUMN IF NOT EXISTS performance_score DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS ai_feedback TEXT,
    ADD COLUMN IF NOT EXISTS suggested_next_difficulty VARCHAR(50);

-- =====================================================
-- LIVE PERFORMANCE METRICS VIEW
-- =====================================================
CREATE OR REPLACE VIEW user_performance_metrics AS
SELECT
    u.id as user_id,
    u.firebase_uid,
    u.display_name,
    COUNT(DISTINCT DATE(ne.created_at)) as active_days,
    COUNT(ne.id) as total_questions,
    SUM(CASE WHEN ne.is_correct THEN 1 ELSE 0 END) as correct_answers,
    ROUND(AVG(CASE WHEN ne.is_correct THEN 1 ELSE 0 END) * 100, 2) as accuracy_percentage,
    MAX(ne.created_at) as last_activity,
    COALESCE(
            (SELECT COUNT(DISTINCT DATE(created_at))
             FROM notebook_entries
             WHERE student_id = u.firebase_uid
               AND created_at >= CURRENT_DATE - INTERVAL '7 days'),
        0
    ) as weekly_active_days,
    COALESCE(
            (SELECT COUNT(*)
             FROM notebook_entries
             WHERE student_id = u.firebase_uid
               AND DATE(created_at) = CURRENT_DATE),
        0
    ) as today_questions,
    COALESCE(
            (SELECT ROUND(AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) * 100, 2)
             FROM notebook_entries
             WHERE student_id = u.firebase_uid
               AND created_at >= CURRENT_TIMESTAMP - INTERVAL '10 minutes'),
        0
    ) as realtime_accuracy
FROM users u
         LEFT JOIN notebook_entries ne ON ne.student_id = u.firebase_uid
GROUP BY u.id, u.firebase_uid, u.display_name;

-- =====================================================
-- DAILY STREAK CALCULATION VIEW
-- =====================================================
CREATE OR REPLACE VIEW user_daily_streaks AS
WITH daily_activity AS (
    SELECT
        firebase_uid,
        DATE(created_at) as activity_date
    FROM notebook_entries
    GROUP BY firebase_uid, DATE(created_at)
),
streak_groups AS (
    SELECT
        firebase_uid,
        activity_date,
        activity_date - (ROW_NUMBER() OVER (PARTITION BY firebase_uid ORDER BY activity_date))::INTEGER * INTERVAL '1 day' as streak_group
    FROM daily_activity
)
SELECT
    firebase_uid,
    COUNT(*) as current_streak,
    MIN(activity_date) as streak_start,
    MAX(activity_date) as streak_end
FROM streak_groups
WHERE streak_group = (
    SELECT streak_group
    FROM streak_groups sg2
    WHERE sg2.firebase_uid = streak_groups.firebase_uid
      AND sg2.activity_date = CURRENT_DATE
    LIMIT 1
    )
GROUP BY firebase_uid, streak_group;

-- =====================================================
-- PERFORMANCE TRENDS VIEW
-- =====================================================
CREATE OR REPLACE VIEW performance_trends AS
SELECT
    ne.firebase_uid,
    DATE_TRUNC('day', ne.created_at) as date,
    COUNT(*) as questions_count,
    SUM(CASE WHEN ne.is_correct THEN 1 ELSE 0 END) as correct_count,
    ROUND(AVG(CASE WHEN ne.is_correct THEN 1 ELSE 0 END) * 100, 2) as daily_accuracy,
    AVG(ne.time_spent) as avg_time_spent,
    ARRAY_AGG(DISTINCT ne.topic) as topics_practiced
FROM notebook_entries ne
WHERE ne.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ne.firebase_uid, DATE_TRUNC('day', ne.created_at)
ORDER BY date DESC;

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- 🔥 FIX: Drop existing triggers first to make migration idempotent
DROP TRIGGER IF EXISTS update_ai_analysis_updated_at ON ai_performance_analysis;
DROP TRIGGER IF EXISTS update_learning_sessions_updated_at ON learning_sessions;

-- Apply trigger to new tables
CREATE TRIGGER update_ai_analysis_updated_at
    BEFORE UPDATE ON ai_performance_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_sessions_updated_at
    BEFORE UPDATE ON learning_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTION FOR REAL-TIME DIFFICULTY ADJUSTMENT
-- =====================================================
CREATE OR REPLACE FUNCTION get_recommended_difficulty(user_firebase_uid VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
recent_accuracy DECIMAL;
    current_diff VARCHAR;
    recommended VARCHAR;
BEGIN
    -- Get accuracy from last 10 questions
SELECT
    ROUND(AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) * 100, 2),
    difficulty
INTO recent_accuracy, current_diff
FROM (
         SELECT is_correct, difficulty
         FROM notebook_entries
         WHERE firebase_uid = user_firebase_uid
         ORDER BY created_at DESC
             LIMIT 10
     ) recent_questions;

-- If no history, start with easy
IF recent_accuracy IS NULL THEN
        RETURN 'easy';
END IF;

    -- Adjust difficulty based on performance
    IF recent_accuracy >= 90 AND current_diff != 'hard' THEN
        recommended := CASE current_diff
            WHEN 'easy' THEN 'medium'
            WHEN 'medium' THEN 'hard'
            ELSE current_diff
END;
    ELSIF recent_accuracy <= 40 AND current_diff != 'easy' THEN
        recommended := CASE current_diff
            WHEN 'hard' THEN 'medium'
            WHEN 'medium' THEN 'easy'
            ELSE current_diff
END;
ELSE
        recommended := current_diff;
END IF;

RETURN COALESCE(recommended, 'medium');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_notebook_entries_perf ON notebook_entries(firebase_uid, created_at DESC, is_correct);
CREATE INDEX IF NOT EXISTS idx_curriculum_progress_perf ON curriculum_progress(firebase_uid, last_practiced_at DESC);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ AI Performance Tracking migration completed successfully';
END $$;

COMMIT;