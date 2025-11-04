// backend/services/enhancedQuestionService.js - MAIN QUESTION SERVICE

const { pool } = require('../config/database');
const aiGenerator = require('./aiQuestionGenerator');
const difficultyEngine = require('./difficultyEngine');
const webScraper = require('./webScrapingService');

class EnhancedQuestionService {
    constructor() {
        this.questionCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get next question for user (SMART SELECTION)
     */
    async getNextQuestion(params) {
        const {
            userId,
            topic,
            subtopic = null,
            personality = 'nexon',
            gradeLevel = 8,
            mode = 'adaptive' // adaptive, practice, exam, review
        } = params;

        console.log(`🎯 [Question Service] Getting next question:`, {
            userId,
            topic,
            personality,
            mode
        });

        try {
            // 1. Get recommended difficulty
            const difficultyRec = await difficultyEngine.getRecommendedDifficulty(userId, topic);
            const difficulty = difficultyRec.difficulty;

            console.log(`📊 [Question Service] Recommended difficulty: ${difficulty} (${difficultyRec.reason})`);

            // 2. Find suitable question from bank
            let question = await this.findSuitableQuestion({
                topic,
                subtopic,
                difficulty,
                gradeLevel,
                personality,
                userId
            });

            // 3. If no suitable question found, generate one
            if (!question) {
                console.log('🤖 [Question Service] No suitable question in bank, generating new one...');

                const generated = await aiGenerator.generateQuestions({
                    topic,
                    subtopic,
                    difficulty,
                    gradeLevel,
                    count: 1,
                    personality
                });

                if (generated.length > 0) {
                    question = generated[0];
                }
            }

            // 4. Format response with personality
            if (question) {
                const formattedQuestion = await this.formatQuestionForPersonality(question, personality);

                return {
                    success: true,
                    question: formattedQuestion,
                    difficulty: difficulty,
                    difficultyReason: difficultyRec.reason,
                    mode: mode
                };
            }

            throw new Error('Failed to get question');
        } catch (error) {
            console.error('❌ [Question Service] Error:', error);
            throw error;
        }
    }

    /**
     * Find suitable question from database
     */
    async findSuitableQuestion(params) {
        const {
            topic,
            subtopic,
            difficulty,
            gradeLevel,
            personality,
            userId
        } = params;

        // Build query to find best matching question
        let query = `
            SELECT qb.*,
                   COUNT(sqh.id) as user_attempts
            FROM question_bank qb
                     LEFT JOIN student_question_history sqh
                               ON sqh.question_id = qb.id
                                   AND sqh.user_id = $1
            WHERE qb.is_active = true
              AND qb.topic = $2
              AND qb.difficulty = $3
              AND qb.grade_level = $4
              AND $5 = ANY(qb.suitable_for_personalities)
        `;

        const params_arr = [userId, topic, difficulty, gradeLevel, personality];
        let param_count = 5;

        if (subtopic) {
            param_count++;
            query += ` AND qb.subtopic = $${param_count}`;
            params_arr.push(subtopic);
        }

        query += `
            GROUP BY qb.id
            HAVING COUNT(sqh.id) = 0  -- Prefer questions user hasn't seen
            ORDER BY qb.quality_score DESC, RANDOM()
            LIMIT 1
        `;

        let result = await pool.query(query, params_arr);

        // If no unseen questions, allow seen ones
        if (result.rows.length === 0) {
            query = query.replace('HAVING COUNT(sqh.id) = 0', 'HAVING COUNT(sqh.id) <= 2');
            result = await pool.query(query, params_arr);
        }

        if (result.rows.length === 0) {
            return null;
        }

        const question = result.rows[0];

        // Update usage stats
        await this.updateQuestionStats(question.id);

        return question;
    }

    /**
     * Format question with personality styling
     */
    async formatQuestionForPersonality(question, personalityName) {
        // Get personality profile
        const personality = await this.getPersonality(personalityName);

        // Format question text with personality style
        let formattedQuestion = { ...question };

        // Add personality-specific greeting if starting session
        if (Math.random() < 0.3) { // 30% chance
            const greeting = this.getRandomElement(personality.greeting_templates);
            formattedQuestion.greeting = greeting;
        }

        // Format explanation based on style
        if (question.explanation) {
            formattedQuestion.explanation = this.formatExplanation(
                question.explanation,
                personality.explanation_style,
                personality.traits
            );
        }

        // Add encouragement message
        if (personality.encouragement_messages && personality.encouragement_messages.length > 0) {
            formattedQuestion.encouragement = this.getRandomElement(personality.encouragement_messages);
        }

        // Add emojis based on personality
        if (personality.emoji_usage === 'high') {
            formattedQuestion = this.addEmojis(formattedQuestion, personality);
        }

        return formattedQuestion;
    }

    /**
     * Format explanation based on personality style
     */
    formatExplanation(explanation, style, traits) {
        let formatted = explanation;

        switch (style) {
            case 'brief':
                // Keep only main points
                const sentences = explanation.split('.');
                formatted = sentences.slice(0, 2).join('.') + '.';
                break;

            case 'detailed':
                // Add more context (already detailed)
                formatted = `הסבר מפורט:\n${explanation}`;
                break;

            case 'visual':
                // Add visual indicators
                formatted = explanation.replace(/(\d+)/g, '**$1**')
                    .replace(/(צעד \d+)/gi, '\n🔹 $1');
                break;

            case 'story':
                // Add storytelling elements
                formatted = `בואו נחשוב על זה ביחד... ${explanation}`;
                break;
        }

        // Add humor if trait is high
        if (traits && traits.humor && traits.humor > 0.7) {
            const jokes = [
                ' (זה יותר קל משנראה!)',
                ' (מתמטיקה זה כיף! 😄)',
                ' (רואים? לא היה כזה נורא!)'
            ];
            formatted += this.getRandomElement(jokes);
        }

        return formatted;
    }

    /**
     * Add emojis to question
     */
    addEmojis(question, personality) {
        const emojiMap = {
            'nexon': ['🔬', '🧪', '⚗️', '🧬', '💡'],
            'gever': ['💪', '🔥', '⚡', '🏃‍♂️', '🎯'],
            'princess': ['✨', '🌸', '💝', '👑', '🦋'],
            'rocker': ['🎸', '🤘', '🎵', '🔊', '😎']
        };

        const emojis = emojiMap[personality.name] || ['✨'];
        const emoji = this.getRandomElement(emojis);

        if (question.question_text && Math.random() < 0.5) {
            question.question_text = `${emoji} ${question.question_text}`;
        }

        return question;
    }

    /**
     * Submit answer and get feedback
     */
    async submitAnswer(params) {
        const {
            userId,
            questionId,
            userAnswer,
            timeSpent,
            hintsUsed = 0,
            sessionId
        } = params;

        console.log(`📝 [Question Service] Submitting answer:`, {
            userId,
            questionId,
            timeSpent
        });

        try {
            // Get question details
            const question = await this.getQuestionById(questionId);
            if (!question) {
                throw new Error('Question not found');
            }

            // Check if correct
            const isCorrect = this.checkAnswer(userAnswer, question.correct_answer);

            // Save to history
            await this.saveQuestionHistory({
                userId,
                questionId,
                userAnswer,
                isCorrect,
                timeSpent,
                hintsUsed,
                sessionId,
                question
            });

            // Update difficulty engine
            await difficultyEngine.updateAfterQuestion(
                userId,
                question.topic,
                isCorrect,
                timeSpent
            );

            // Update question stats
            await this.updateQuestionPerformance(questionId, isCorrect, timeSpent);

            // Get personality-specific feedback
            const personality = await this.getPersonality(params.personality || 'nexon');
            const feedback = this.generateFeedback(isCorrect, personality, question);

            return {
                success: true,
                isCorrect,
                correctAnswer: question.correct_answer,
                explanation: question.explanation,
                solutionSteps: question.solution_steps,
                feedback,
                nextRecommendation: await difficultyEngine.getRecommendedDifficulty(userId, question.topic)
            };
        } catch (error) {
            console.error('❌ [Question Service] Submit answer failed:', error);
            throw error;
        }
    }

    /**
     * Check if answer is correct
     */
    checkAnswer(userAnswer, correctAnswer) {
        // Normalize answers
        const normalize = (str) => {
            return String(str)
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '')
                .replace(/[^\w\u0590-\u05FF\d.]/g, '');
        };

        const normalizedUser = normalize(userAnswer);
        const normalizedCorrect = normalize(correctAnswer);

        // Exact match
        if (normalizedUser === normalizedCorrect) {
            return true;
        }

        // Check if numeric - allow small tolerance
        const userNum = parseFloat(normalizedUser);
        const correctNum = parseFloat(normalizedCorrect);

        if (!isNaN(userNum) && !isNaN(correctNum)) {
            const tolerance = Math.abs(correctNum) * 0.01; // 1% tolerance
            return Math.abs(userNum - correctNum) <= tolerance;
        }

        return false;
    }

    /**
     * Generate personality-specific feedback
     */
    generateFeedback(isCorrect, personality, question) {
        if (isCorrect) {
            const message = this.getRandomElement(personality.success_messages || [
                'מצוין!',
                'נכון!',
                'עבודה טובה!'
            ]);

            return {
                message,
                tone: 'success',
                encouragement: true
            };
        } else {
            const message = this.getRandomElement(personality.retry_messages || [
                'לא נכון, אבל זה בסדר - בוא ננסה שוב!',
                'קרוב מאוד! עוד ניסיון?',
                'לא מדויק, אבל אתה על הדרך הנכונה!'
            ]);

            return {
                message,
                tone: 'retry',
                encouragement: true,
                hint: question.hints ? question.hints[0] : null
            };
        }
    }

    /**
     * Save question to history
     */
    async saveQuestionHistory(data) {
        const query = `
            INSERT INTO student_question_history (
                user_id, question_id, user_answer, is_correct,
                time_spent_seconds, hints_used, session_id,
                question_snapshot, practice_mode, difficulty_at_time
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
        `;

        const values = [
            data.userId,
            data.questionId,
            data.userAnswer,
            data.isCorrect,
            data.timeSpent,
            data.hintsUsed,
            data.sessionId,
            JSON.stringify(data.question),
            data.practiceMode || 'adaptive',
            data.question.difficulty
        ];

        const result = await pool.query(query, values);
        return result.rows[0].id;
    }

    /**
     * Update question statistics
     */
    async updateQuestionStats(questionId) {
        const query = `
            UPDATE question_bank
            SET
                usage_count = usage_count + 1,
                last_used_at = NOW()
            WHERE id = $1
        `;

        await pool.query(query, [questionId]);
    }

    /**
     * Update question performance metrics
     */
    async updateQuestionPerformance(questionId, isCorrect, timeSpent) {
        const query = `
            WITH stats AS (
                SELECT
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_attempts,
                    AVG(time_spent_seconds) as avg_time
                FROM student_question_history
                WHERE question_id = $1
            )
            UPDATE question_bank qb
            SET
                success_rate = (stats.correct_attempts::DECIMAL / stats.total_attempts) * 100,
                average_time_seconds = stats.avg_time
                FROM stats
            WHERE qb.id = $1
        `;

        await pool.query(query, [questionId]);
    }

    /**
     * Get question by ID
     */
    async getQuestionById(id) {
        const query = `SELECT * FROM question_bank WHERE id = $1`;
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }

    /**
     * Get personality profile
     */
    async getPersonality(name) {
        const cacheKey = `personality_${name}`;

        if (this.questionCache.has(cacheKey)) {
            return this.questionCache.get(cacheKey);
        }

        const query = `
            SELECT * FROM personality_profiles
            WHERE name = $1 AND is_active = true
        `;

        const result = await pool.query(query, [name]);

        if (result.rows.length === 0) {
            // Return default
            return {
                name: 'nexon',
                display_name_he: 'נקסון',
                traits: { humor: 0.5, encouragement: 0.9 },
                explanation_style: 'detailed',
                greeting_templates: ['שלום!'],
                success_messages: ['מצוין!'],
                retry_messages: ['נסה שוב!']
            };
        }

        const personality = result.rows[0];
        this.questionCache.set(cacheKey, personality);

        return personality;
    }

    /**
     * Get practice session questions
     */
    async getPracticeSession(params) {
        const {
            userId,
            topic,
            personality = 'nexon',
            questionsCount = 10,
            mode = 'adaptive'
        } = params;

        console.log(`📚 [Question Service] Creating practice session:`, {
            userId,
            topic,
            questionsCount
        });

        try {
            const questions = [];
            const difficultyRec = await difficultyEngine.getRecommendedDifficulty(userId, topic);

            for (let i = 0; i < questionsCount; i++) {
                const question = await this.getNextQuestion({
                    userId,
                    topic,
                    personality,
                    mode
                });

                if (question.success) {
                    questions.push(question.question);
                }
            }

            return {
                success: true,
                questions,
                startingDifficulty: difficultyRec.difficulty,
                recommendation: difficultyRec,
                sessionId: `session_${Date.now()}_${userId}`
            };
        } catch (error) {
            console.error('❌ [Question Service] Practice session failed:', error);
            throw error;
        }
    }

    /**
     * Get user statistics
     */
    async getUserStats(userId) {
        const query = `
            SELECT
                COUNT(*) as total_questions,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_answers,
                ROUND(AVG(CASE WHEN is_correct THEN 100.0 ELSE 0.0 END), 2) as accuracy,
                AVG(time_spent_seconds) as avg_time,
                COUNT(DISTINCT DATE(created_at)) as active_days,
                MAX(created_at) as last_activity
            FROM student_question_history
            WHERE user_id = $1
        `;

        const result = await pool.query(query, [userId]);
        return result.rows[0];
    }

    /**
     * Get topic performance
     */
    async getTopicPerformance(userId, topic) {
        const query = `
            SELECT
                qb.difficulty,
                COUNT(*) as questions_answered,
                SUM(CASE WHEN sqh.is_correct THEN 1 ELSE 0 END) as correct_answers,
                ROUND(AVG(CASE WHEN sqh.is_correct THEN 100.0 ELSE 0.0 END), 2) as accuracy,
                AVG(sqh.time_spent_seconds) as avg_time
            FROM student_question_history sqh
                     JOIN question_bank qb ON sqh.question_id = qb.id
            WHERE sqh.user_id = $1 AND qb.topic = $2
            GROUP BY qb.difficulty
        `;

        const result = await pool.query(query, [userId, topic]);
        return result.rows;
    }

    /**
     * Utility: Get random element from array
     */
    getRandomElement(array) {
        if (!array || array.length === 0) return '';
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.questionCache.clear();
        console.log('🧹 [Question Service] Cache cleared');
    }
}

module.exports = new EnhancedQuestionService();