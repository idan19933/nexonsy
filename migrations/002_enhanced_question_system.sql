-- server/migrations/002_enhanced_question_system.sql
-- Nexon AI - Enhanced Question System with AI, Scraping & Adaptive Difficulty
-- This adds the new smart question system to your existing database

-- =====================================================
-- QUESTION BANK TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS question_bank (
                                             id SERIAL PRIMARY KEY,
                                             question_text TEXT NOT NULL,
                                             question_type VARCHAR(50) NOT NULL DEFAULT 'open_ended',
    topic VARCHAR(255) NOT NULL,
    subtopic VARCHAR(255),
    grade_level INTEGER NOT NULL DEFAULT 8,
    difficulty VARCHAR(50) NOT NULL DEFAULT 'medium',
    correct_answer TEXT NOT NULL,
    wrong_answers JSONB DEFAULT '[]'::jsonb,
    explanation TEXT,
    solution_steps JSONB DEFAULT '[]'::jsonb,
    hints JSONB DEFAULT '[]'::jsonb,

    -- Metadata
    source VARCHAR(255) DEFAULT 'manual',
    source_url TEXT,
    language VARCHAR(10) DEFAULT 'he',

    -- Learning metadata
    cognitive_level VARCHAR(50) DEFAULT 'apply',
    israeli_curriculum_code VARCHAR(100),
    keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
    related_topics TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Quality metrics
    quality_score INTEGER DEFAULT 50,
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2),
    average_time_seconds INTEGER,

    -- Personality adaptation
    suitable_for_personalities TEXT[] DEFAULT ARRAY['nexon', 'gever', 'princess', 'rocker'],
    explanation_style VARCHAR(50) DEFAULT 'detailed',

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,

    CONSTRAINT unique_question UNIQUE (question_text, topic, difficulty)
    );

CREATE INDEX idx_question_topic ON question_bank(topic, difficulty);
CREATE INDEX idx_question_grade ON question_bank(grade_level, difficulty);
CREATE INDEX idx_question_quality ON question_bank(quality_score DESC);
CREATE INDEX idx_question_active ON question_bank(is_active, is_verified);

-- =====================================================
-- WEB SCRAPING SOURCES
-- =====================================================
CREATE TABLE IF NOT EXISTS scraping_sources (
                                                id SERIAL PRIMARY KEY,
                                                name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    source_type VARCHAR(50),
    scraping_config JSONB DEFAULT '{}'::jsonb,

    is_active BOOLEAN DEFAULT true,
    last_scraped_at TIMESTAMP,
    next_scrape_at TIMESTAMP,
    scrape_frequency_hours INTEGER DEFAULT 168,

    reliability_score INTEGER DEFAULT 50,
    total_questions_scraped INTEGER DEFAULT 0,
    successful_scrapes INTEGER DEFAULT 0,
    failed_scrapes INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Insert Israeli education sources
INSERT INTO scraping_sources (name, url, source_type, scraping_config) VALUES
                                                                           ('פורטל למידה', 'https://lemida.education.gov.il', 'education_portal', '{"enabled": true, "max_questions": 100}'::jsonb),
                                                                           ('מתמטיקה לחיים', 'http://mathlife.co.il', 'math_site', '{"enabled": true, "max_questions": 50}'::jsonb),
                                                                           ('תרגול במתמטיקה', 'http://www.targul.co.il', 'exercise_bank', '{"enabled": true, "max_questions": 200}'::jsonb)
    ON CONFLICT DO NOTHING;

-- =====================================================
-- SCRAPING LOGS
-- =====================================================
CREATE TABLE IF NOT EXISTS scraping_logs (
                                             id SERIAL PRIMARY KEY,
                                             source_id INTEGER REFERENCES scraping_sources(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'running',

    questions_found INTEGER DEFAULT 0,
    questions_added INTEGER DEFAULT 0,
    questions_duplicates INTEGER DEFAULT 0,
    questions_invalid INTEGER DEFAULT 0,

    error_message TEXT,
    scraping_details JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX idx_scraping_logs_source ON scraping_logs(source_id);
CREATE INDEX idx_scraping_logs_status ON scraping_logs(status);

-- =====================================================
-- STUDENT QUESTION HISTORY (Enhanced)
-- Link to existing notebook_entries via firebase_uid
-- =====================================================
CREATE TABLE IF NOT EXISTS student_question_history (
                                                        id SERIAL PRIMARY KEY,
                                                        user_id VARCHAR(255) NOT NULL, -- Can be firebase_uid
    question_id INTEGER REFERENCES question_bank(id) ON DELETE CASCADE,

    question_snapshot JSONB DEFAULT '{}'::jsonb,

    user_answer TEXT,
    is_correct BOOLEAN NOT NULL,
    time_spent_seconds INTEGER DEFAULT 0,
    attempts_count INTEGER DEFAULT 1,
    hints_used INTEGER DEFAULT 0,

    session_id VARCHAR(255),
    practice_mode VARCHAR(50) DEFAULT 'adaptive',
    difficulty_at_time VARCHAR(50),

    student_rating INTEGER,
    found_helpful BOOLEAN,
    reported_issue TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX idx_history_user ON student_question_history(user_id, created_at DESC);
CREATE INDEX idx_history_question ON student_question_history(question_id);
CREATE INDEX idx_history_session ON student_question_history(session_id);

-- =====================================================
-- PERSONALITY PROFILES
-- =====================================================
CREATE TABLE IF NOT EXISTS personality_profiles (
                                                    id SERIAL PRIMARY KEY,
                                                    name VARCHAR(100) NOT NULL UNIQUE,
    display_name_he VARCHAR(100) NOT NULL,
    description TEXT,

    traits JSONB DEFAULT '{}'::jsonb,

    explanation_style VARCHAR(50) DEFAULT 'detailed',
    question_presentation VARCHAR(50) DEFAULT 'direct',
    feedback_style VARCHAR(50) DEFAULT 'encouraging',

    preferred_question_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    difficulty_progression VARCHAR(50) DEFAULT 'gradual',
    hint_availability VARCHAR(50) DEFAULT 'always',

    emoji_usage VARCHAR(50) DEFAULT 'medium',
    color_scheme JSONB DEFAULT '{}'::jsonb,

    greeting_templates TEXT[] DEFAULT ARRAY[]::TEXT[],
    encouragement_messages TEXT[] DEFAULT ARRAY[]::TEXT[],
    success_messages TEXT[] DEFAULT ARRAY[]::TEXT[],
    retry_messages TEXT[] DEFAULT ARRAY[]::TEXT[],

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Insert personality profiles
INSERT INTO personality_profiles (name, display_name_he, description, traits, explanation_style, question_presentation, feedback_style, preferred_question_types, emoji_usage, greeting_templates, encouragement_messages, success_messages, retry_messages) VALUES
                                                                                                                                                                                                                                                                 ('nexon', 'נקסון המומחה', 'מדען חכם ומעודד',
                                                                                                                                                                                                                                                                  '{"humor": 0.5, "formality": 0.4, "encouragement": 0.9, "challenge": 0.6}'::jsonb,
                                                                                                                                                                                                                                                                  'detailed', 'direct', 'encouraging',
                                                                                                                                                                                                                                                                  ARRAY['calculation', 'word_problem', 'puzzle'],
                                                                                                                                                                                                                                                                  'medium',
                                                                                                                                                                                                                                                                  ARRAY['שלום! בוא נפתור ביחד בעיות מתמטיות מרתקות! 🧪', 'היי! מוכן לאתגר מתמטי? אני כאן לעזור! 🔬'],
                                                                                                                                                                                                                                                                  ARRAY['מעולה! אתה על הדרך הנכונה! 🌟', 'נהדר! המשך ככה! 🚀', 'אתה עושה עבודה מצוינת! 💪'],
                                                                                                                                                                                                                                                                  ARRAY['פצצה! פתרת את זה בצורה מושלמת! 🎉', 'וואו! תשובה נכונה! אתה מלך המתמטיקה! 🏆', 'מדהים! זה בדיוק נכון! ⭐'],
                                                                                                                                                                                                                                                                  ARRAY['זה בסדר, נסה שוב! כל טעות מלמדת 📚', 'קרוב מאוד! בוא ננסה שוב ביחד 🎯', 'לא נורא! בוא נפתור את זה צעד אחר צעד 🔍']
                                                                                                                                                                                                                                                                 ),
                                                                                                                                                                                                                                                                 ('gever', 'גבר המנצח', 'אתגרי וספורטיבי',
                                                                                                                                                                                                                                                                  '{"humor": 0.8, "formality": 0.1, "encouragement": 0.7, "challenge": 0.95}'::jsonb,
                                                                                                                                                                                                                                                                  'brief', 'gamified', 'competitive',
                                                                                                                                                                                                                                                                  ARRAY['calculation', 'speed_drill'],
                                                                                                                                                                                                                                                                  'high',
                                                                                                                                                                                                                                                                  ARRAY['יאללה אחי! בוא נרסק כמה תרגילים! 💪', 'מה קורה צ׳מפיון! מוכן לנצח? ⚡'],
                                                                                                                                                                                                                                                                  ARRAY['חזק! ממשיך לדהור! 🔥', 'כן! אתה במצב fire! 🏃‍♂️', 'בום! עוד אחד בפח! 💥'],
                                                                                                                                                                                                                                                                  ARRAY['יששש! נדפקת על זה! 🎯', 'אלוף! זה איך שעושים את זה! 👊', 'חיית על! מושלם! 🏆'],
                                                                                                                                                                                                                                                                  ARRAY['אופס! לא נורא, ננסה שוב חזק יותר! 💪', 'כמעט! עוד ניסיון וזה שלך! ⚡', 'לא נכון, אבל אתה close! בוא שוב! 🎯']
                                                                                                                                                                                                                                                                 ),
                                                                                                                                                                                                                                                                 ('princess', 'הנסיכה החכמה', 'עדינה ומעודדת',
                                                                                                                                                                                                                                                                  '{"humor": 0.6, "formality": 0.6, "encouragement": 1.0, "challenge": 0.4}'::jsonb,
                                                                                                                                                                                                                                                                  'detailed', 'story_based', 'encouraging',
                                                                                                                                                                                                                                                                  ARRAY['word_problem', 'visual', 'real_world'],
                                                                                                                                                                                                                                                                  'high',
                                                                                                                                                                                                                                                                  ARRAY['שלום יקירה! בואי נלמד ביחד בצורה מהנה! ✨', 'היי מתוקה! מוכנה להרפתקה מתמטית? 🌸'],
                                                                                                                                                                                                                                                                  ARRAY['כל הכבוד! את עושה עבודה נפלאה! 🌟', 'מקסים! את נהדרת! 💝', 'וואו! איזו התקדמות יפה! 🦋'],
                                                                                                                                                                                                                                                                  ARRAY['מושלם! ידעתי שתצליחי! את פשוט מדהימה! 👑', 'ברבור! תשובה נכונה! את המלכה! 💖', 'כל הכבוד! את גאונה! ✨'],
                                                                                                                                                                                                                                                                  ARRAY['אין דבר כזה! בואי ננסה שוב יחד 🌺', 'זה בסדר מתוקה, נלמד מזה ונמשיך! 🌈', 'לא נכון הפעם, אבל זה חלק מהלמידה! 🦄']
                                                                                                                                                                                                                                                                 ),
                                                                                                                                                                                                                                                                 ('rocker', 'הרוקר המגניב', 'מגניב וספונטני',
                                                                                                                                                                                                                                                                  '{"humor": 0.95, "formality": 0.0, "encouragement": 0.8, "challenge": 0.8}'::jsonb,
                                                                                                                                                                                                                                                                  'brief', 'gamified', 'humorous',
                                                                                                                                                                                                                                                                  ARRAY['puzzle', 'creative', 'word_problem'],
                                                                                                                                                                                                                                                                  'high',
                                                                                                                                                                                                                                                                  ARRAY['יו מה קורה! בוא נעשה כאן מהומה מתמטית! 🎸', 'היי רוקר! מוכן לשבור את השאלות האלה? 🤘'],
                                                                                                                                                                                                                                                                  ARRAY['רוק אנד רוול! ממשיך חזק! 🎸', 'יאללה! זה מה שאני אוהב לראות! 🤘', 'בום! עוד תרגיל בבייבי! 🔥'],
                                                                                                                                                                                                                                                                  ARRAY['גמבאייי! זה נכון! אתה מלך! 👑', 'סחתיין! פצחת את זה כמו פרו! 🎯', 'לייייק! מושלם! 🌟'],
                                                                                                                                                                                                                                                                  ARRAY['אופס! זה קצת לא נכון, אבל יאללה שוב! 😎', 'טעות קטנה, בוא נתקן ונמשיך לרוק! 🎸', 'לא מדויק, אבל אתה על זה! 🤘']
                                                                                                                                                                                                                                                                 )
    ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ADAPTIVE DIFFICULTY ENGINE
-- =====================================================
CREATE TABLE IF NOT EXISTS difficulty_adjustments (
                                                      id SERIAL PRIMARY KEY,
                                                      user_id VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,

    current_difficulty VARCHAR(50) NOT NULL DEFAULT 'medium',
    current_level INTEGER DEFAULT 5,

    recent_accuracy DECIMAL(5,2) DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,

    performance_trend VARCHAR(50) DEFAULT 'stable',
    trend_confidence DECIMAL(5,2) DEFAULT 0,

    recommended_difficulty VARCHAR(50),
    recommendation_reason TEXT,

    difficulty_history JSONB DEFAULT '[]'::jsonb,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, topic)
    );

CREATE INDEX idx_difficulty_user ON difficulty_adjustments(user_id);
CREATE INDEX idx_difficulty_topic ON difficulty_adjustments(topic);

-- =====================================================
-- AI GENERATION TEMPLATES
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_question_templates (
                                                     id SERIAL PRIMARY KEY,
                                                     template_name VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    difficulty VARCHAR(50) NOT NULL,
    question_type VARCHAR(50) NOT NULL,

    prompt_template TEXT NOT NULL,
    example_question TEXT,

    constraints JSONB DEFAULT '{}'::jsonb,

    success_rate DECIMAL(5,2),
    usage_count INTEGER DEFAULT 0,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX idx_ai_templates_topic ON ai_question_templates(topic, difficulty);

-- =====================================================
-- QUESTION FEEDBACK
-- =====================================================
CREATE TABLE IF NOT EXISTS question_feedback (
                                                 id SERIAL PRIMARY KEY,
                                                 question_id INTEGER REFERENCES question_bank(id) ON DELETE CASCADE,
    user_id VARCHAR(255),

    feedback_type VARCHAR(50),
    feedback_text TEXT,

    user_difficulty VARCHAR(50),
    user_accuracy DECIMAL(5,2),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX idx_feedback_question ON question_feedback(question_id);
CREATE INDEX idx_feedback_user ON question_feedback(user_id);

-- =====================================================
-- RECOMMENDATION CACHE
-- =====================================================
CREATE TABLE IF NOT EXISTS recommendation_cache (
                                                    id SERIAL PRIMARY KEY,
                                                    user_id VARCHAR(255) NOT NULL,
    personality VARCHAR(50),

    recommended_questions INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    weak_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
    strong_topics TEXT[] DEFAULT ARRAY[]::TEXT[],

    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    cache_key VARCHAR(255) UNIQUE,

    UNIQUE(user_id, personality)
    );

CREATE INDEX idx_cache_user ON recommendation_cache(user_id);
CREATE INDEX idx_cache_expires ON recommendation_cache(expires_at);

-- =====================================================
-- SYSTEM CONFIGURATION
-- =====================================================
CREATE TABLE IF NOT EXISTS system_config (
                                             key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

INSERT INTO system_config (key, value, description) VALUES
                                                        ('scraping', '{"enabled": true, "interval_hours": 168, "max_questions_per_run": 500}'::jsonb, 'Web scraping configuration'),
                                                        ('ai_generation', '{"enabled": true, "model": "claude-sonnet-4-5", "max_tokens": 4000}'::jsonb, 'AI question generation settings'),
                                                        ('difficulty_engine', '{"adaptation_speed": "moderate", "min_questions_before_adjust": 5, "confidence_threshold": 0.7}'::jsonb, 'Adaptive difficulty settings'),
                                                        ('quality_control', '{"min_quality_score": 60, "auto_verify_threshold": 80, "require_verification": true}'::jsonb, 'Question quality control'),
                                                        ('personality', '{"default": "nexon", "allow_switching": true, "adapt_based_on_performance": true}'::jsonb, 'Personality system settings')
    ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_enhanced_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_question_bank_updated_at
    BEFORE UPDATE ON question_bank
    FOR EACH ROW
    EXECUTE FUNCTION update_enhanced_updated_at();

CREATE TRIGGER update_scraping_sources_updated_at
    BEFORE UPDATE ON scraping_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_enhanced_updated_at();

CREATE TRIGGER update_personality_profiles_updated_at
    BEFORE UPDATE ON personality_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_enhanced_updated_at();

CREATE TRIGGER update_difficulty_adjustments_updated_at
    BEFORE UPDATE ON difficulty_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION update_enhanced_updated_at();

-- =====================================================
-- VIEWS FOR EASY ACCESS
-- =====================================================

CREATE OR REPLACE VIEW quality_questions AS
SELECT
    qb.*,
    COUNT(sqh.id) as times_used,
    AVG(CASE WHEN sqh.is_correct THEN 100.0 ELSE 0.0 END) as actual_success_rate
FROM question_bank qb
         LEFT JOIN student_question_history sqh ON qb.id = sqh.question_id
WHERE qb.is_active = true
  AND qb.quality_score >= 60
GROUP BY qb.id;

CREATE OR REPLACE VIEW user_performance_summary AS
SELECT
    user_id,
    COUNT(*) as total_questions,
    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_answers,
    ROUND(AVG(CASE WHEN is_correct THEN 100.0 ELSE 0.0 END), 2) as accuracy,
    AVG(time_spent_seconds) as avg_time,
    COUNT(DISTINCT DATE(created_at)) as active_days,
    MAX(created_at) as last_activity
FROM student_question_history
GROUP BY user_id;

CREATE OR REPLACE VIEW user_topic_performance AS
SELECT
    sqh.user_id,
    qb.topic,
    qb.difficulty,
    COUNT(*) as questions_answered,
    SUM(CASE WHEN sqh.is_correct THEN 1 ELSE 0 END) as correct_answers,
    ROUND(AVG(CASE WHEN sqh.is_correct THEN 100.0 ELSE 0.0 END), 2) as accuracy
FROM student_question_history sqh
         JOIN question_bank qb ON sqh.question_id = qb.id
GROUP BY sqh.user_id, qb.topic, qb.difficulty;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
COMMIT;