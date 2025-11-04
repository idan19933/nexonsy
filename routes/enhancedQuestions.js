// server/routes/enhancedQuestions.js - ES6 VERSION
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * GET /api/questions/next
 * Get next adaptive question for user
 */
router.get('/next', async (req, res) => {
    try {
        const {
            userId,
            topic,
            subtopic,
            personality = 'nexon',
            gradeLevel = 8,
            mode = 'adaptive'
        } = req.query;

        if (!userId || !topic) {
            return res.status(400).json({
                success: false,
                error: 'userId and topic are required'
            });
        }

        console.log('📚 Enhanced question request:', { userId, topic, subtopic });

        // Get a random quality question from the database
        const result = await pool.query(
            `SELECT id, question_text, correct_answer, hints, explanation, difficulty, topic_id
             FROM quality_questions 
             WHERE topic_id = $1 AND is_active = true
             ORDER BY RANDOM()
             LIMIT 1`,
            [topic]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: false,
                error: 'No questions available for this topic',
                fallback: true
            });
        }

        const question = result.rows[0];

        res.json({
            success: true,
            question: {
                id: question.id,
                question: question.question_text,
                correctAnswer: question.correct_answer,
                hints: question.hints || [],
                explanation: question.explanation,
                difficulty: question.difficulty,
                topicId: question.topic_id
            }
        });

    } catch (error) {
        console.error('❌ Enhanced question error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            fallback: true
        });
    }
});

/**
 * POST /api/questions/submit
 * Submit answer and get feedback
 */
router.post('/submit', async (req, res) => {
    try {
        const {
            userId,
            questionId,
            userAnswer,
            timeSpent,
            hintsUsed,
            sessionId
        } = req.body;

        if (!userId || !questionId || userAnswer === undefined) {
            return res.status(400).json({
                success: false,
                error: 'userId, questionId, and userAnswer are required'
            });
        }

        console.log('📝 Submit answer:', { userId, questionId, userAnswer });

        // Save to history
        await pool.query(
            `INSERT INTO student_question_history 
             (user_id, question_id, user_answer, is_correct, time_spent_seconds, hints_used)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, questionId, userAnswer, false, timeSpent || 0, hintsUsed || 0]
        );

        res.json({
            success: true,
            message: 'Answer submitted successfully'
        });

    } catch (error) {
        console.error('❌ Submit answer error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/questions/stats
 * Get user statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        const query = `
            SELECT 
                COUNT(*) as total_answered,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_answers,
                AVG(time_spent_seconds) as avg_time
            FROM student_question_history
            WHERE user_id = $1
        `;

        const result = await pool.query(query, [userId]);
        const stats = result.rows[0];

        res.json({
            success: true,
            stats: {
                totalAnswered: parseInt(stats.total_answered || 0),
                correctAnswers: parseInt(stats.correct_answers || 0),
                avgTime: parseFloat(stats.avg_time || 0).toFixed(1),
                accuracy: stats.total_answered > 0
                    ? ((stats.correct_answers / stats.total_answered) * 100).toFixed(1)
                    : 0
            }
        });

    } catch (error) {
        console.error('❌ Get stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/questions/feedback
 * Submit feedback about a question
 */
router.post('/feedback', async (req, res) => {
    try {
        const {
            userId,
            questionId,
            feedbackType,
            feedbackText,
            userDifficulty,
            userAccuracy
        } = req.body;

        if (!userId || !questionId || !feedbackType) {
            return res.status(400).json({
                success: false,
                error: 'userId, questionId, and feedbackType are required'
            });
        }

        const query = `
            INSERT INTO question_feedback (
                question_id, user_id, feedback_type, feedback_text,
                user_difficulty, user_accuracy
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;

        const result = await pool.query(query, [
            questionId,
            userId,
            feedbackType,
            feedbackText,
            userDifficulty,
            userAccuracy
        ]);

        res.json({
            success: true,
            feedbackId: result.rows[0].id,
            message: 'תודה על המשוב!'
        });
    } catch (error) {
        console.error('❌ Feedback error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/questions/bank/stats
 * Get question bank statistics
 */
router.get('/bank/stats', async (req, res) => {
    try {
        const query = `
            SELECT 
                source,
                difficulty,
                COUNT(*) as count,
                AVG(quality_score) as avg_quality,
                SUM(usage_count) as total_usage
            FROM question_bank
            WHERE is_active = true
            GROUP BY source, difficulty
            ORDER BY source, difficulty
        `;

        const result = await pool.query(query);

        res.json({
            success: true,
            stats: result.rows
        });
    } catch (error) {
        console.error('❌ Bank stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ✅ ES6 DEFAULT EXPORT
export default router;