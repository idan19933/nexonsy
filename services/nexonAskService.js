// server/services/nexonAskService.js - COMPLETE WORKING VERSION
import pool from '../config/database.js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

class NexonAskService {
    /**
     * Generate intelligent response based on student's progress
     */
    async generateResponse(userId, message) {
        try {
            console.log('🤖 Generating NexonAsk response for:', userId);
            console.log('📝 Message:', message);

            // Get student data
            const studentData = await this.getStudentData(userId);
            
            // Build context for Claude
            const systemPrompt = this.buildSystemPrompt(studentData);
            
            // Call Claude API
            const response = await anthropic.messages.create({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 1500,
                temperature: 0.7,
                system: systemPrompt,
                messages: [{
                    role: 'user',
                    content: message
                }]
            });

            const reply = response.content[0].text;
            console.log('✅ Response generated successfully');

            return {
                success: true,
                response: reply,
                insights: studentData.insights
            };

        } catch (error) {
            console.error('❌ Error generating response:', error);
            return {
                success: false,
                error: error.message,
                response: 'סליחה, אני לא יכול לענות כרגע. נסה שוב מאוחר יותר.'
            };
        }
    }

    /**
     * Get student data from database
     */
    async getStudentData(userId) {
        try {
            // Get user ID
            const userQuery = 'SELECT id, display_name FROM users WHERE firebase_uid = $1';
            const userResult = await pool.query(userQuery, [userId]);
            
            if (userResult.rows.length === 0) {
                return {
                    userName: 'תלמיד',
                    stats: { totalExercises: 0, correctAnswers: 0, accuracy: 0 },
                    weakTopics: [],
                    recentActivity: [],
                    insights: null
                };
            }

            const studentId = userResult.rows[0].id;
            const userName = userResult.rows[0].display_name || 'תלמיד';

            // Get overall stats
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_exercises,
                    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
                    ROUND(AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) * 100) as accuracy
                FROM notebook_entries
                WHERE student_id = $1
            `;
            const statsResult = await pool.query(statsQuery, [studentId]);
            const stats = statsResult.rows[0];

            // Get weak topics (< 60% accuracy)
            const weakQuery = `
                SELECT 
                    topic,
                    COUNT(*) as attempts,
                    ROUND(AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) * 100) as accuracy
                FROM notebook_entries
                WHERE student_id = $1
                GROUP BY topic
                HAVING AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) * 100 < 60
                ORDER BY accuracy ASC
                LIMIT 3
            `;
            const weakResult = await pool.query(weakQuery, [studentId]);

            // Get recent activity
            const recentQuery = `
                SELECT topic, is_correct, created_at
                FROM notebook_entries
                WHERE student_id = $1
                ORDER BY created_at DESC
                LIMIT 5
            `;
            const recentResult = await pool.query(recentQuery, [studentId]);

            return {
                userName,
                stats: {
                    totalExercises: parseInt(stats.total_exercises) || 0,
                    correctAnswers: parseInt(stats.correct_count) || 0,
                    accuracy: parseInt(stats.accuracy) || 0
                },
                weakTopics: weakResult.rows,
                recentActivity: recentResult.rows,
                insights: this.generateInsights(stats, weakResult.rows)
            };

        } catch (error) {
            console.error('❌ Error getting student data:', error);
            return {
                userName: 'תלמיד',
                stats: { totalExercises: 0, correctAnswers: 0, accuracy: 0 },
                weakTopics: [],
                recentActivity: [],
                insights: null
            };
        }
    }

    /**
     * Build system prompt for Claude
     */
    buildSystemPrompt(studentData) {
        const { userName, stats, weakTopics, recentActivity } = studentData;

        return `אתה נקסון, עוזר AI חכם ומסביר פנים שעוזר לתלמידים ללמוד מתמטיקה.

שם התלמיד: ${userName}

נתוני התקדמות:
- סה"כ תרגילים: ${stats.totalExercises}
- תשובות נכונות: ${stats.correctAnswers}
- דיוק: ${stats.accuracy}%

${weakTopics.length > 0 ? `נושאים לשיפור:
${weakTopics.map(t => `- ${t.topic} (${t.accuracy}% הצלחה)`).join('\n')}` : ''}

הנחיות:
1. ענה בעברית בלבד
2. היה מעודד ותומך
3. תן המלצות ספציפיות על סמך ההתקדמות
4. השתמש באימוג'ים במידה
5. אם נשאל על נושא ספציפי, הצע קישור לתרגול באפליקציה
6. אם אין מספיק נתונים, עודד את התלמיד להתחיל לתרגל

פורמט לקישורים: כאשר ממליץ על תרגול, כתוב:
"לחץ כאן לתרגול [שם הנושא]: /practice?topic=[שם-נושא]"

היה ממוקד, תמציתי ומועיל!`;
    }

    /**
     * Generate insights for banner
     */
    generateInsights(stats, weakTopics) {
        const accuracy = parseInt(stats.accuracy) || 0;
        const total = parseInt(stats.total_exercises) || 0;

        if (total === 0) {
            return {
                message: 'התחל לתרגל כדי לקבל ניתוח מותאם אישית! 🚀',
                type: 'info',
                icon: '🎯'
            };
        }

        if (accuracy >= 80) {
            return {
                message: `מצוין! דיוק של ${accuracy}% - המשך כך! 🌟`,
                type: 'success',
                icon: '⭐'
            };
        }

        if (weakTopics.length > 0) {
            return {
                message: `כדאי לחזק את ${weakTopics[0].topic} - דיוק נוכחי ${weakTopics[0].accuracy}%`,
                type: 'warning',
                icon: '💪'
            };
        }

        return {
            message: `דיוק כולל: ${accuracy}% - המשך לתרגל! 📚`,
            type: 'info',
            icon: '📊'
        };
    }

    /**
     * Get insights for banner display
     */
    async getInsights(userId) {
        try {
            const studentData = await this.getStudentData(userId);
            
            return {
                success: true,
                insights: studentData.insights,
                stats: studentData.stats
            };

        } catch (error) {
            console.error('❌ Error getting insights:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default new NexonAskService();
