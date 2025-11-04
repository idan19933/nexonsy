import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import pool from '../config/database.js';

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/nexon-ask', async (req, res) => {
    try {
        const { userId, message, conversationHistory } = req.body;

        // Get user context
        let userContext = '';
        if (userId) {
            const statsResult = await pool.query(`
                SELECT 
                    COUNT(DISTINCT topic_id) as total_topics,
                    SUM(exercises_completed) as total_exercises,
                    SUM(exercises_correct) as total_correct
                FROM topic_progress
                WHERE user_id = $1
            `, [userId]);

            const weakTopicsResult = await pool.query(`
                SELECT topic_id, 
                       ROUND((exercises_correct::DECIMAL / NULLIF(exercises_completed, 0)) * 100, 1) as success_rate
                FROM topic_progress
                WHERE user_id = $1 AND exercises_completed > 0
                ORDER BY success_rate ASC
                LIMIT 3
            `, [userId]);

            userContext = `
המידע על התלמיד:
- סה"כ נושאים שתרגל: ${statsResult.rows[0].total_topics || 0}
- סה"כ תרגילים: ${statsResult.rows[0].total_exercises || 0}
- נכונות: ${statsResult.rows[0].total_correct || 0}
- נושאים חלשים: ${weakTopicsResult.rows.map(r => r.topic_id).join(', ') || 'אין מספיק נתונים'}
`;
        }

        const systemPrompt = `אתה נקסון, עוזר AI חכם ומעודד במתמטיקה לתלמידי ישראל. 
תפקידך:
1. לענות על שאלות מתמטיקה בצורה ברורה ומעשירה
2. להמליץ על נושאים רלוונטיים לתרגול
3. לתת אסטרטגיות תרגול מותאמות אישית
4. להפנות לתרגילים במחברת הדיגיטלית
5. לעודד ולחזק ביטחון עצמי

${userContext}

חשוב:
- תמיד ענה בעברית
- היה ידידותי ומעודד
- השתמש באמוג'י בצורה מתונה
- תן המלצות ספציפיות ומעשיות
- אם יש נושא חלש, המלץ לתרגל אותו`;

        const messages = [
            ...conversationHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            { role: 'user', content: message }
        ];

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: systemPrompt,
            messages
        });

        const aiResponse = response.content[0].text;

        // Generate recommendations based on weak topics
        const recommendations = [];
        if (userId) {
            const weakTopicsResult = await pool.query(`
                SELECT topic_id 
                FROM topic_progress
                WHERE user_id = $1 AND exercises_completed > 0
                ORDER BY (exercises_correct::DECIMAL / NULLIF(exercises_completed, 0)) ASC
                LIMIT 2
            `, [userId]);

            weakTopicsResult.rows.forEach(row => {
                recommendations.push(`תרגל עוד את הנושא: ${row.topic_id}`);
            });
        }

        res.json({
            success: true,
            response: aiResponse,
            recommendations: recommendations.length > 0 ? recommendations : null
        });

    } catch (error) {
        console.error('Nexon Ask error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;