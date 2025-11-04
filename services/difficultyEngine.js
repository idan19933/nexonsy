// backend/services/difficultyEngine.js - ADAPTIVE DIFFICULTY ENGINE

const { pool } = require('../config/database');

class DifficultyEngine {
    constructor() {
        this.difficultyLevels = {
            'easy': 1,
            'medium': 2,
            'hard': 3
        };

        this.adaptationRules = {
            minQuestionsBeforeAdjust: 5,
            accuracyThresholds: {
                tooEasy: 85,      // Above this = increase difficulty
                tooHard: 50,      // Below this = decrease difficulty
                perfect: 70       // Sweet spot range: 70-85%
            },
            speedFactors: {
                veryFast: 0.6,    // Answered in < 60% of average time
                fast: 0.8,        // Answered in < 80% of average time
                normal: 1.0,
                slow: 1.2         // Answered in > 120% of average time
            }
        };
    }

    /**
     * Get recommended difficulty for user and topic
     */
    async getRecommendedDifficulty(userId, topic) {
        console.log(`🎯 [Difficulty Engine] Getting recommendation for user ${userId}, topic: ${topic}`);

        try {
            // Get current difficulty state
            const currentState = await this.getCurrentDifficultyState(userId, topic);

            // Analyze recent performance
            const performance = await this.analyzeRecentPerformance(userId, topic);

            // Calculate recommended difficulty
            const recommendation = this.calculateRecommendation(currentState, performance);

            // Save recommendation
            await this.saveRecommendation(userId, topic, recommendation);

            console.log(`✅ [Difficulty Engine] Recommendation:`, recommendation);
            return recommendation;
        } catch (error) {
            console.error('❌ [Difficulty Engine] Error:', error);
            return {
                difficulty: 'medium',
                level: 5,
                confidence: 0,
                reason: 'Error occurred, defaulting to medium'
            };
        }
    }

    /**
     * Get current difficulty state
     */
    async getCurrentDifficultyState(userId, topic) {
        const query = `
            SELECT * FROM difficulty_adjustments
            WHERE user_id = $1 AND topic = $2
        `;

        const result = await pool.query(query, [userId, topic]);

        if (result.rows.length === 0) {
            // Initialize new state
            return {
                user_id: userId,
                topic: topic,
                current_difficulty: 'medium',
                current_level: 5,
                questions_answered: 0,
                correct_answers: 0,
                recent_accuracy: 0,
                performance_trend: 'stable'
            };
        }

        return result.rows[0];
    }

    /**
     * Analyze recent performance
     */
    async analyzeRecentPerformance(userId, topic, lastNQuestions = 10) {
        const query = `
            SELECT 
                sqh.is_correct,
                sqh.time_spent_seconds,
                sqh.hints_used,
                qb.difficulty,
                qb.average_time_seconds
            FROM student_question_history sqh
            JOIN question_bank qb ON sqh.question_id = qb.id
            WHERE sqh.user_id = $1 
            AND qb.topic = $2
            ORDER BY sqh.created_at DESC
            LIMIT $3
        `;

        const result = await pool.query(query, [userId, topic, lastNQuestions]);
        const questions = result.rows;

        if (questions.length === 0) {
            return {
                questionsAnswered: 0,
                accuracy: 0,
                avgSpeed: 1.0,
                hintsUsed: 0,
                trend: 'insufficient_data'
            };
        }

        // Calculate metrics
        const correctCount = questions.filter(q => q.is_correct).length;
        const accuracy = (correctCount / questions.length) * 100;

        // Calculate speed factor
        const speedFactors = questions.map(q => {
            if (!q.average_time_seconds || q.average_time_seconds === 0) return 1.0;
            return q.time_spent_seconds / q.average_time_seconds;
        });
        const avgSpeed = speedFactors.reduce((a, b) => a + b, 0) / speedFactors.length;

        // Calculate total hints used
        const totalHints = questions.reduce((sum, q) => sum + (q.hints_used || 0), 0);

        // Analyze trend (recent vs older)
        const recentHalf = questions.slice(0, Math.floor(questions.length / 2));
        const olderHalf = questions.slice(Math.floor(questions.length / 2));

        const recentAccuracy = recentHalf.filter(q => q.is_correct).length / recentHalf.length * 100;
        const olderAccuracy = olderHalf.filter(q => q.is_correct).length / olderHalf.length * 100;

        let trend = 'stable';
        if (recentAccuracy > olderAccuracy + 10) trend = 'improving';
        if (recentAccuracy < olderAccuracy - 10) trend = 'declining';

        return {
            questionsAnswered: questions.length,
            accuracy,
            avgSpeed,
            hintsUsed: totalHints,
            trend,
            recentAccuracy,
            olderAccuracy
        };
    }

    /**
     * Calculate difficulty recommendation
     */
    calculateRecommendation(currentState, performance) {
        const { questionsAnswered, accuracy, avgSpeed, trend } = performance;
        const { accuracyThresholds, minQuestionsBeforeAdjust, speedFactors } = this.adaptationRules;

        // Not enough data yet
        if (questionsAnswered < minQuestionsBeforeAdjust) {
            return {
                difficulty: currentState.current_difficulty || 'medium',
                level: currentState.current_level || 5,
                confidence: (questionsAnswered / minQuestionsBeforeAdjust) * 100,
                reason: `נדרשות עוד ${minQuestionsBeforeAdjust - questionsAnswered} שאלות לחישוב מדויק`,
                shouldAdjust: false
            };
        }

        let newLevel = currentState.current_level || 5;
        let reason = '';
        let shouldAdjust = false;

        // Analyze accuracy
        if (accuracy >= accuracyThresholds.tooEasy) {
            // Too easy - increase difficulty
            if (trend === 'improving' || trend === 'stable') {
                newLevel = Math.min(10, newLevel + 1);
                reason = `דיוק גבוה (${accuracy.toFixed(1)}%) - מעלה רמת קושי`;
                shouldAdjust = true;
            }
        } else if (accuracy <= accuracyThresholds.tooHard) {
            // Too hard - decrease difficulty
            newLevel = Math.max(1, newLevel - 1);
            reason = `דיוק נמוך (${accuracy.toFixed(1)}%) - מוריד רמת קושי`;
            shouldAdjust = true;
        } else {
            // Perfect range - slight adjustments based on speed and trend
            if (avgSpeed < speedFactors.veryFast && accuracy >= accuracyThresholds.perfect) {
                newLevel = Math.min(10, newLevel + 1);
                reason = `פותר מהר מאוד ובדיוק גבוה - מאתגר יותר`;
                shouldAdjust = true;
            } else if (avgSpeed > speedFactors.slow && accuracy < accuracyThresholds.perfect) {
                newLevel = Math.max(1, newLevel - 1);
                reason = `לוקח זמן ודיוק בינוני - מקל מעט`;
                shouldAdjust = true;
            } else {
                reason = `רמת קושי מושלמת - ממשיכים באותה רמה`;
            }
        }

        // Consider trend
        if (trend === 'declining' && !shouldAdjust) {
            newLevel = Math.max(1, newLevel - 1);
            reason = `מגמת ירידה בביצועים - מתאים רמת קושי`;
            shouldAdjust = true;
        }

        // Map level to difficulty name
        const difficulty = this.levelToDifficulty(newLevel);

        return {
            difficulty,
            level: newLevel,
            confidence: 85 + (questionsAnswered / minQuestionsBeforeAdjust) * 15,
            reason,
            shouldAdjust,
            metrics: {
                accuracy: accuracy.toFixed(1),
                speed: avgSpeed.toFixed(2),
                trend
            }
        };
    }

    /**
     * Convert level (1-10) to difficulty name
     */
    levelToDifficulty(level) {
        if (level <= 3) return 'easy';
        if (level <= 7) return 'medium';
        return 'hard';
    }

    /**
     * Convert difficulty name to level
     */
    difficultyToLevel(difficulty) {
        const mapping = {
            'easy': 2,
            'medium': 5,
            'hard': 8
        };
        return mapping[difficulty] || 5;
    }

    /**
     * Save recommendation to database
     */
    async saveRecommendation(userId, topic, recommendation) {
        const query = `
            INSERT INTO difficulty_adjustments (
                user_id, topic, current_difficulty, current_level,
                recommended_difficulty, recommendation_reason,
                performance_trend, trend_confidence,
                questions_answered, recent_accuracy
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (user_id, topic) 
            DO UPDATE SET
                current_difficulty = EXCLUDED.current_difficulty,
                current_level = EXCLUDED.current_level,
                recommended_difficulty = EXCLUDED.recommended_difficulty,
                recommendation_reason = EXCLUDED.recommendation_reason,
                performance_trend = EXCLUDED.performance_trend,
                trend_confidence = EXCLUDED.trend_confidence,
                questions_answered = EXCLUDED.questions_answered,
                recent_accuracy = EXCLUDED.recent_accuracy,
                difficulty_history = difficulty_adjustments.difficulty_history || 
                    jsonb_build_object(
                        'timestamp', NOW()::text,
                        'difficulty', EXCLUDED.current_difficulty,
                        'reason', EXCLUDED.recommendation_reason
                    )::jsonb,
                updated_at = NOW()
        `;

        await pool.query(query, [
            userId,
            topic,
            recommendation.difficulty,
            recommendation.level,
            recommendation.difficulty,
            recommendation.reason,
            recommendation.metrics?.trend || 'stable',
            recommendation.confidence,
            0, // Will be updated by actual question answers
            parseFloat(recommendation.metrics?.accuracy || 0)
        ]);
    }

    /**
     * Update difficulty after question answered
     */
    async updateAfterQuestion(userId, topic, isCorrect, timeSpent) {
        console.log(`📊 [Difficulty Engine] Updating after question:`, {
            userId,
            topic,
            isCorrect,
            timeSpent
        });

        try {
            // Get current state
            const state = await this.getCurrentDifficultyState(userId, topic);

            // Update counts
            const newQuestionsAnswered = state.questions_answered + 1;
            const newCorrectAnswers = state.correct_answers + (isCorrect ? 1 : 0);
            const newAccuracy = (newCorrectAnswers / newQuestionsAnswered) * 100;

            // Update database
            const query = `
                UPDATE difficulty_adjustments
                SET 
                    questions_answered = $1,
                    correct_answers = $2,
                    recent_accuracy = $3,
                    updated_at = NOW()
                WHERE user_id = $4 AND topic = $5
            `;

            await pool.query(query, [
                newQuestionsAnswered,
                newCorrectAnswers,
                newAccuracy,
                userId,
                topic
            ]);

            // Check if we should recalculate recommendation
            if (newQuestionsAnswered % this.adaptationRules.minQuestionsBeforeAdjust === 0) {
                console.log('🔄 [Difficulty Engine] Recalculating recommendation...');
                await this.getRecommendedDifficulty(userId, topic);
            }

            return {
                questionsAnswered: newQuestionsAnswered,
                accuracy: newAccuracy,
                updated: true
            };
        } catch (error) {
            console.error('❌ [Difficulty Engine] Update failed:', error);
            return null;
        }
    }

    /**
     * Get difficulty progression for user
     */
    async getDifficultyProgression(userId, topic) {
        const query = `
            SELECT 
                difficulty_history,
                current_difficulty,
                current_level,
                questions_answered,
                recent_accuracy,
                performance_trend
            FROM difficulty_adjustments
            WHERE user_id = $1 AND topic = $2
        `;

        const result = await pool.query(query, [userId, topic]);

        if (result.rows.length === 0) {
            return {
                history: [],
                current: 'medium',
                level: 5
            };
        }

        const data = result.rows[0];
        return {
            history: data.difficulty_history || [],
            current: data.current_difficulty,
            level: data.current_level,
            questionsAnswered: data.questions_answered,
            accuracy: data.recent_accuracy,
            trend: data.performance_trend
        };
    }

    /**
     * Reset difficulty for topic
     */
    async resetDifficulty(userId, topic) {
        console.log(`🔄 [Difficulty Engine] Resetting difficulty for ${userId} - ${topic}`);

        const query = `
            UPDATE difficulty_adjustments
            SET 
                current_difficulty = 'medium',
                current_level = 5,
                questions_answered = 0,
                correct_answers = 0,
                recent_accuracy = 0,
                performance_trend = 'stable',
                updated_at = NOW()
            WHERE user_id = $1 AND topic = $2
        `;

        await pool.query(query, [userId, topic]);
        return { success: true, difficulty: 'medium', level: 5 };
    }

    /**
     * Get difficulty statistics
     */
    async getDifficultyStats(userId) {
        const query = `
            SELECT 
                topic,
                current_difficulty,
                current_level,
                questions_answered,
                recent_accuracy,
                performance_trend,
                recommendation_reason
            FROM difficulty_adjustments
            WHERE user_id = $1
            ORDER BY recent_accuracy DESC
        `;

        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    /**
     * Batch update difficulties for all topics
     */
    async updateAllDifficulties(userId) {
        console.log(`🔄 [Difficulty Engine] Updating all difficulties for user ${userId}`);

        try {
            // Get all topics user has practiced
            const topicsQuery = `
                SELECT DISTINCT qb.topic
                FROM student_question_history sqh
                JOIN question_bank qb ON sqh.question_id = qb.id
                WHERE sqh.user_id = $1
            `;

            const topicsResult = await pool.query(topicsQuery, [userId]);
            const topics = topicsResult.rows.map(r => r.topic);

            const results = [];
            for (const topic of topics) {
                const recommendation = await this.getRecommendedDifficulty(userId, topic);
                results.push({
                    topic,
                    ...recommendation
                });
            }

            console.log(`✅ [Difficulty Engine] Updated ${results.length} topics`);
            return results;
        } catch (error) {
            console.error('❌ [Difficulty Engine] Batch update failed:', error);
            return [];
        }
    }
}

module.exports = new DifficultyEngine();