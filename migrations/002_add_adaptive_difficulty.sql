-- Add Adaptive Difficulty System
-- Migration: 002_add_adaptive_difficulty.sql
-- Description: Adds adaptive_answers table for tracking student performance

-- =====================================================
-- ADAPTIVE ANSWERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS adaptive_answers (
                                                id SERIAL PRIMARY KEY,
                                                user_id INTEGER NOT NULL,
                                                topic_id VARCHAR(100),
    subtopic_id VARCHAR(100),
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    is_correct BOOLEAN NOT NULL,
    time_taken INTEGER,
    hints_used INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_adaptive_user_topic ON adaptive_answers(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_adaptive_created ON adaptive_answers(created_at);
CREATE INDEX IF NOT EXISTS idx_adaptive_difficulty ON adaptive_answers(difficulty);
CREATE INDEX IF NOT EXISTS idx_adaptive_user_created ON adaptive_answers(user_id, created_at);

-- Verification
SELECT 'adaptive_answers table created successfully' AS status;