// server/services/aiPerformanceAnalysis.js
import Anthropic from '@anthropic-ai/sdk';
import pool from '../config/database.js';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

class AIPerformanceAnalysisService {
    /**
     * Analyze student performance and recommend difficulty adjustment
     */
    async analyzePerformance(userId) {
        try {
            // Get recent performance data
            const performanceData = await this.getPerformanceMetrics(userId);
            const topicAnalysis = await this.getTopicPerformance(userId);
            const learningPatterns = await this.getLearningPatterns(userId);

            // Build AI prompt
            const systemPrompt = `אתה מומחה בלמידה מותאמת אישית במתמטיקה. נתח את ביצועי התלמיד והמלץ על:
            1. רמת קושי מומלצת לשאלות הבאות
            2. נושאים שדורשים חיזוק
            3. אסטרטגיית למידה מותאמת
            4. משוב מותאם אישית`;

            const userPrompt = `נתוני התלמיד:
            - דיוק כללי: ${performanceData.accuracy}%
            - זמן ממוצע לשאלה: ${performanceData.avgTimeSeconds} שניות
            - רצף נוכחי: ${performanceData.currentStreak}
            - מספר רמזים ממוצע: ${performanceData.avgHints}
            
            ביצועים לפי נושא:
            ${JSON.stringify(topicAnalysis, null, 2)}
            
            דפוסי למידה:
            ${JSON.stringify(learningPatterns, null, 2)}`;

            const response = await anthropic.messages.create({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 1000,
                temperature: 0.7,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }]
            });

            const analysis = this.parseAIResponse(response.content[0].text);

            // Save analysis to database
            await this.saveAnalysis(userId, analysis);

            return {
                success: true,
                analysis,
                metrics: performanceData,
                recommendations: this.generateRecommendations(analysis, performanceData)
            };

        } catch (error) {
            console.error('❌ Performance analysis error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get performance metrics from last 30 days
     */
    async getPerformanceMetrics(userId) {
        try {
            const userQuery = 'SELECT id FROM users WHERE firebase_uid = $1';
            const userResult = await pool.query(userQuery, [userId]);
            if (userResult.rows.length === 0) return this.getDefaultMetrics();

            const studentId = userResult.rows[0].id;

            const metricsQuery = `
                SELECT 
                    COUNT(*) as total_questions,
                    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_answers,
                    ROUND(AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) * 100) as accuracy,
                    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_time_seconds,
                    MAX(CASE WHEN is_correct THEN created_at ELSE NULL END) as last_correct,
                    COUNT(DISTINCT DATE(created_at)) as active_days
                FROM notebook_entries
                WHERE student_id = $1 
                    AND created_at >= NOW() - INTERVAL '30 days'
            `;

            const result = await pool.query(metricsQuery, [studentId]);
            const metrics = result.rows[0];

            // Calculate current streak
            const streakQuery = `
                WITH daily_results AS (
                    SELECT 
                        DATE(created_at) as practice_date,
                        SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) > 0 as had_correct
                    FROM notebook_entries
                    WHERE student_id = $1
                    GROUP BY DATE(created_at)
                    ORDER BY practice_date DESC
                )
                SELECT COUNT(*) as current_streak
                FROM daily_results
                WHERE practice_date >= CURRENT_DATE - (
                    SELECT COUNT(*)::INTEGER 
                    FROM daily_results 
                    WHERE had_correct = true
                )
            `;

            const streakResult = await pool.query(streakQuery, [studentId]);

            // Get hints usage
            const hintsQuery = `
                SELECT AVG(hints_used) as avg_hints
                FROM curriculum_progress
                WHERE user_id = $1
                    AND created_at >= NOW() - INTERVAL '30 days'
            `;

            const hintsResult = await pool.query(hintsQuery, [userId]);

            return {
                totalQuestions: parseInt(metrics.total_questions) || 0,
                correctAnswers: parseInt(metrics.correct_answers) || 0,
                accuracy: parseInt(metrics.accuracy) || 0,
                avgTimeSeconds: Math.round(metrics.avg_time_seconds) || 0,
                currentStreak: streakResult.rows[0]?.current_streak || 0,
                activeDays: parseInt(metrics.active_days) || 0,
                avgHints: parseFloat(hintsResult.rows[0]?.avg_hints) || 0
            };

        } catch (error) {
            console.error('❌ Error getting metrics:', error);
            return this.getDefaultMetrics();
        }
    }

    /**
     * Get topic-specific performance
     */
    async getTopicPerformance(userId) {
        try {
            const userQuery = 'SELECT id FROM users WHERE firebase_uid = $1';
            const userResult = await pool.query(userQuery, [userId]);
            if (userResult.rows.length === 0) return [];

            const studentId = userResult.rows[0].id;

            const query = `
                SELECT 
                    topic,
                    COUNT(*) as attempts,
                    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
                    ROUND(AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) * 100) as accuracy,
                    MAX(created_at) as last_practice,
                    difficulty
                FROM notebook_entries
                WHERE student_id = $1
                    AND created_at >= NOW() - INTERVAL '30 days'
                GROUP BY topic, difficulty
                ORDER BY accuracy ASC
            `;

            const result = await pool.query(query, [studentId]);

            return result.rows.map(row => ({
                topic: row.topic,
                difficulty: row.difficulty,
                attempts: parseInt(row.attempts),
                correct: parseInt(row.correct),
                accuracy: parseInt(row.accuracy),
                lastPractice: row.last_practice,
                needsImprovement: parseInt(row.accuracy) < 70
            }));

        } catch (error) {
            console.error('❌ Error getting topic performance:', error);
            return [];
        }
    }

    /**
     * Get learning patterns and trends
     */
    async getLearningPatterns(userId) {
        try {
            const userQuery = 'SELECT id FROM users WHERE firebase_uid = $1';
            const userResult = await pool.query(userQuery, [userId]);
            if (userResult.rows.length === 0) return this.getDefaultPatterns();

            const studentId = userResult.rows[0].id;

            // Time of day analysis
            const timeQuery = `
                SELECT 
                    EXTRACT(HOUR FROM created_at) as hour_of_day,
                    COUNT(*) as questions,
                    ROUND(AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) * 100) as accuracy
                FROM notebook_entries
                WHERE student_id = $1
                    AND created_at >= NOW() - INTERVAL '30 days'
                GROUP BY EXTRACT(HOUR FROM created_at)
                ORDER BY accuracy DESC
            `;

            const timeResult = await pool.query(timeQuery, [studentId]);

            // Difficulty progression
            const difficultyQuery = `
                WITH weekly_performance AS (
                    SELECT 
                        DATE_TRUNC('week', created_at) as week,
                        difficulty,
                        ROUND(AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) * 100) as accuracy
                    FROM notebook_entries
                    WHERE student_id = $1
                        AND created_at >= NOW() - INTERVAL '8 weeks'
                    GROUP BY week, difficulty
                )
                SELECT * FROM weekly_performance
                ORDER BY week, difficulty
            `;

            const difficultyResult = await pool.query(difficultyQuery, [studentId]);

            // Error patterns
            const errorQuery = `
                SELECT 
                    COUNT(*) as total_errors,
                    COUNT(DISTINCT topic) as unique_error_topics,
                    topic as most_error_topic
                FROM notebook_entries
                WHERE student_id = $1
                    AND is_correct = false
                    AND created_at >= NOW() - INTERVAL '30 days'
                GROUP BY topic
                ORDER BY COUNT(*) DESC
                LIMIT 3
            `;

            const errorResult = await pool.query(errorQuery, [studentId]);

            return {
                bestPerformanceTime: timeResult.rows[0]?.hour_of_day || 16,
                difficultyProgression: difficultyResult.rows,
                commonErrors: errorResult.rows,
                learningVelocity: this.calculateLearningVelocity(difficultyResult.rows)
            };

        } catch (error) {
            console.error('❌ Error getting patterns:', error);
            return this.getDefaultPatterns();
        }
    }

    /**
     * Parse AI response into structured data
     */
    parseAIResponse(responseText) {
        try {
            // Extract difficulty recommendation
            const difficultyMatch = responseText.match(/רמת קושי:\s*(קל|בינוני|קשה)/);
            const difficulty = difficultyMatch ? difficultyMatch[1] : 'בינוני';

            // Extract weak topics
            const weakTopicsMatch = responseText.match(/נושאים לחיזוק:(.*?)(?=\n\n|$)/s);
            const weakTopics = weakTopicsMatch ?
                weakTopicsMatch[1].split('\n').filter(t => t.trim()).map(t => t.trim().replace(/^[-*]\s*/, '')) : [];

            // Extract feedback
            const feedbackMatch = responseText.match(/משוב:(.*?)(?=\n\n|$)/s);
            const feedback = feedbackMatch ? feedbackMatch[1].trim() : responseText;

            return {
                recommendedDifficulty: this.mapDifficultyToEnglish(difficulty),
                weakTopics,
                personalizedFeedback: feedback,
                timestamp: new Date()
            };

        } catch (error) {
            console.error('❌ Error parsing AI response:', error);
            return {
                recommendedDifficulty: 'medium',
                weakTopics: [],
                personalizedFeedback: 'המשך לתרגל!',
                timestamp: new Date()
            };
        }
    }

    /**
     * Map Hebrew difficulty to English
     */
    mapDifficultyToEnglish(hebrewDifficulty) {
        const map = {
            'קל': 'easy',
            'בינוני': 'medium',
            'קשה': 'hard'
        };
        return map[hebrewDifficulty] || 'medium';
    }

    /**
     * Calculate learning velocity (improvement rate)
     */
    calculateLearningVelocity(progressionData) {
        if (progressionData.length < 2) return 0;

        const recentWeeks = progressionData.slice(-4);
        let totalImprovement = 0;
        let comparisons = 0;

        for (let i = 1; i < recentWeeks.length; i++) {
            const prev = recentWeeks[i - 1];
            const curr = recentWeeks[i];

            if (prev.difficulty === curr.difficulty) {
                totalImprovement += (curr.accuracy - prev.accuracy);
                comparisons++;
            }
        }

        return comparisons > 0 ? Math.round(totalImprovement / comparisons) : 0;
    }

    /**
     * Generate actionable recommendations
     */
    generateRecommendations(analysis, metrics) {
        const recommendations = [];

        // Difficulty recommendation
        if (metrics.accuracy >= 85) {
            recommendations.push({
                type: 'difficulty',
                action: 'increase',
                message: 'הביצועים שלך מצוינים! מומלץ לעבור לשאלות קשות יותר',
                icon: 'rocket'
            });
        } else if (metrics.accuracy < 60) {
            recommendations.push({
                type: 'difficulty',
                action: 'decrease',
                message: 'כדאי להתמקד בשאלות קלות יותר כדי לבנות בסיס חזק',
                icon: 'foundation'
            });
        }

        // Time management
        if (metrics.avgTimeSeconds > 300) {
            recommendations.push({
                type: 'time',
                action: 'practice',
                message: 'נסה לפתור שאלות מהר יותר - תרגול יעזור!',
                icon: 'clock'
            });
        }

        // Topic focus
        if (analysis.weakTopics && analysis.weakTopics.length > 0) {
            recommendations.push({
                type: 'topics',
                action: 'focus',
                message: `התמקד בנושאים: ${analysis.weakTopics.slice(0, 2).join(', ')}`,
                icon: 'target'
            });
        }

        // Streak motivation
        if (metrics.currentStreak >= 7) {
            recommendations.push({
                type: 'motivation',
                action: 'celebrate',
                message: `רצף של ${metrics.currentStreak} ימים! המשך כך!`,
                icon: 'fire'
            });
        }

        return recommendations;
    }

    /**
     * Save analysis to database
     */
    async saveAnalysis(userId, analysis) {
        try {
            await pool.query(
                `INSERT INTO ai_performance_analysis 
                (user_id, recommended_difficulty, weak_topics, feedback, created_at)
                VALUES ($1, $2, $3, $4, NOW())`,
                [
                    userId,
                    analysis.recommendedDifficulty,
                    JSON.stringify(analysis.weakTopics),
                    analysis.personalizedFeedback
                ]
            );
        } catch (error) {
            console.error('❌ Error saving analysis:', error);
        }
    }

    /**
     * Get default metrics
     */
    getDefaultMetrics() {
        return {
            totalQuestions: 0,
            correctAnswers: 0,
            accuracy: 0,
            avgTimeSeconds: 0,
            currentStreak: 0,
            activeDays: 0,
            avgHints: 0
        };
    }

    /**
     * Get default patterns
     */
    getDefaultPatterns() {
        return {
            bestPerformanceTime: 16,
            difficultyProgression: [],
            commonErrors: [],
            learningVelocity: 0
        };
    }

    /**
     * Get real-time difficulty recommendation
     */
    async getRealtimeDifficulty(userId) {
        try {
            // Get last 10 questions performance
            const userQuery = 'SELECT id FROM users WHERE firebase_uid = $1';
            const userResult = await pool.query(userQuery, [userId]);
            if (userResult.rows.length === 0) return 'medium';

            const studentId = userResult.rows[0].id;

            const recentQuery = `
                SELECT 
                    is_correct,
                    difficulty
                FROM notebook_entries
                WHERE student_id = $1
                ORDER BY created_at DESC
                LIMIT 10
            `;

            const result = await pool.query(recentQuery, [studentId]);

            if (result.rows.length < 5) return 'easy'; // Start easy for new users

            const recentAccuracy = result.rows.filter(r => r.is_correct).length / result.rows.length * 100;
            const currentDifficulty = result.rows[0].difficulty;

            // Adaptive difficulty logic
            if (recentAccuracy >= 90 && currentDifficulty !== 'hard') {
                return currentDifficulty === 'easy' ? 'medium' : 'hard';
            } else if (recentAccuracy <= 40 && currentDifficulty !== 'easy') {
                return currentDifficulty === 'hard' ? 'medium' : 'easy';
            }

            return currentDifficulty || 'medium';

        } catch (error) {
            console.error('❌ Error getting realtime difficulty:', error);
            return 'medium';
        }
    }
}

export default new AIPerformanceAnalysisService();