// server/routes/aiAnalysisRoutes.js
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * GET /api/ai/performance-analysis - Get AI performance analysis
 */
router.get('/performance-analysis', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing userId parameter'
            });
        }

        console.log('🤖 Getting AI analysis for user:', userId);

        // Get performance metrics
        const metricsResult = await pool.query(
            'SELECT * FROM user_performance_metrics WHERE firebase_uid = $1',
            [userId]
        );

        if (metricsResult.rows.length === 0) {
            return res.json({
                success: true,
                analysis: {
                    recommendedDifficulty: 'medium',
                    weakTopics: [],
                    personalizedFeedback: 'התחל לתרגל כדי לקבל המלצות מותאמות אישית!',
                    recommendations: [{
                        type: 'motivation',
                        action: 'start',
                        message: 'בוא נתחיל! כל מסע מתחיל בצעד ראשון 🚀',
                        icon: 'rocket'
                    }]
                }
            });
        }

        const metrics = metricsResult.rows[0];

        // Get weak topics
        const weakTopicsResult = await pool.query(`
            SELECT 
                topic,
                COUNT(*) as attempts,
                ROUND(AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) * 100) as accuracy
            FROM notebook_entries ne
            JOIN users u ON ne.user_id = u.id
            WHERE u.firebase_uid = $1
            GROUP BY topic
            HAVING AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) < 0.7
            ORDER BY accuracy ASC
            LIMIT 3
        `, [userId]);

        // Generate recommendations
        const recommendations = [];

        if (metrics.accuracy_percentage >= 85) {
            recommendations.push({
                type: 'difficulty',
                action: 'increase',
                message: 'הביצועים שלך מצוינים! מומלץ לעבור לשאלות קשות יותר',
                icon: 'rocket'
            });
        } else if (metrics.accuracy_percentage < 60) {
            recommendations.push({
                type: 'difficulty',
                action: 'decrease',
                message: 'כדאי להתמקד בשאלות קלות יותר כדי לבנות בסיס חזק',
                icon: 'foundation'
            });
        }

        if (weakTopicsResult.rows.length > 0) {
            recommendations.push({
                type: 'topics',
                action: 'focus',
                message: `התמקד בנושאים: ${weakTopicsResult.rows.map(r => r.topic).slice(0, 2).join(', ')}`,
                icon: 'target'
            });
        }

        // Generate personalized feedback
        let feedback = '';
        if (metrics.accuracy_percentage >= 80) {
            feedback = `מעולה ${metrics.display_name || 'תלמיד'}! אתה מראה הבנה מצוינת של החומר עם דיוק של ${metrics.accuracy_percentage}%. המשך כך! 🌟`;
        } else if (metrics.accuracy_percentage >= 60) {
            feedback = `כל הכבוד על ההתקדמות! דיוק של ${metrics.accuracy_percentage}% מראה שאתה בכיוון הנכון. המשך לתרגל! 💪`;
        } else {
            feedback = `אל תוותר! למידה דורשת זמן ותרגול. בוא נעבוד יחד על שיפור הדיוק שלך. אתה יכול! 🤗`;
        }

        res.json({
            success: true,
            analysis: {
                recommendedDifficulty: metrics.accuracy_percentage >= 85 ? 'hard' :
                    metrics.accuracy_percentage <= 50 ? 'easy' : 'medium',
                weakTopics: weakTopicsResult.rows.map(r => r.topic),
                personalizedFeedback: feedback,
                recommendations: recommendations
            },
            metrics: {
                accuracy: metrics.accuracy_percentage,
                totalQuestions: metrics.total_questions,
                activeDays: metrics.active_days
            }
        });

    } catch (error) {
        console.error('❌ Error in AI analysis:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get AI analysis',
            error: error.message
        });
    }
});

export default router;