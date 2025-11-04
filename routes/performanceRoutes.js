// server/routes/performanceRoutes.js - FIXED SQL QUERIES
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * GET /api/performance/live-stats - Get live performance statistics
 */
router.get('/live-stats', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        console.log('📊 Fetching live stats for userId:', userId);

        // Get internal user ID from Firebase UID
        const userResult = await pool.query(
            'SELECT id FROM users WHERE firebase_uid = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            console.log('⚠️ User not found, returning empty stats');
            return res.json({
                success: true,
                stats: {
                    totalQuestions: 0,
                    correctAnswers: 0,
                    accuracy: 0,
                    activeDays: 0,
                    todayQuestions: 0,
                    weeklyActiveDays: 0,
                    realtimeAccuracy: 0,
                    lastActivity: null
                }
            });
        }

        const internalUserId = userResult.rows[0].id;

        // ✅ FIXED: Total questions and correct answers
        const totalStatsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_questions,
                SUM(CASE WHEN is_correct = true THEN 1 ELSE 0 END) as correct_answers
            FROM notebook_entries
            WHERE user_id = $1
        `, [internalUserId]);

        const totalQuestions = parseInt(totalStatsResult.rows[0]?.total_questions) || 0;
        const correctAnswers = parseInt(totalStatsResult.rows[0]?.correct_answers) || 0;
        const accuracy = totalQuestions > 0
            ? Math.round((correctAnswers / totalQuestions) * 100)
            : 0;

        // ✅ FIXED: Today's questions
        const todayResult = await pool.query(`
            SELECT COUNT(*) as today_count
            FROM notebook_entries
            WHERE user_id = $1
            AND DATE(created_at) = CURRENT_DATE
        `, [internalUserId]);

        const todayQuestions = parseInt(todayResult.rows[0]?.today_count) || 0;

        // ✅ FIXED: Weekly active days
        const weeklyDaysResult = await pool.query(`
            SELECT COUNT(DISTINCT DATE(created_at)) as active_days
            FROM notebook_entries
            WHERE user_id = $1
            AND created_at >= CURRENT_DATE - INTERVAL '7 days'
        `, [internalUserId]);

        const weeklyActiveDays = parseInt(weeklyDaysResult.rows[0]?.active_days) || 0;

        // ✅ FIXED: Realtime accuracy (last 10 questions)
        const recentResult = await pool.query(`
            SELECT is_correct
            FROM notebook_entries
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 10
        `, [internalUserId]);

        let realtimeAccuracy = 0;
        if (recentResult.rows.length > 0) {
            const recentCorrect = recentResult.rows.filter(r => r.is_correct === true).length;
            realtimeAccuracy = Math.round((recentCorrect / recentResult.rows.length) * 100);
        }

        // ✅ FIXED: Last activity
        const lastActivityResult = await pool.query(`
            SELECT created_at
            FROM notebook_entries
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 1
        `, [internalUserId]);

        const lastActivity = lastActivityResult.rows[0]?.created_at || null;

        // ✅ FIXED: Total active days (all time)
        const activeDaysResult = await pool.query(`
            SELECT COUNT(DISTINCT DATE(created_at)) as total_active_days
            FROM notebook_entries
            WHERE user_id = $1
        `, [internalUserId]);

        const activeDays = parseInt(activeDaysResult.rows[0]?.total_active_days) || 0;

        const stats = {
            totalQuestions,
            correctAnswers,
            accuracy,
            activeDays,
            todayQuestions,
            weeklyActiveDays,
            realtimeAccuracy,
            lastActivity
        };

        console.log('✅ Live stats calculated:', stats);

        return res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('❌ Error fetching live stats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch live stats',
            details: error.message
        });
    }
});

export default router;