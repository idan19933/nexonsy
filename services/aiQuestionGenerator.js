// backend/services/aiQuestionGenerator.js - AI QUESTION GENERATION SERVICE

const Anthropic = require('@anthropic-ai/sdk');
const { pool } = require('../config/database');

class AIQuestionGenerator {
    constructor() {
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        this.model = 'claude-sonnet-4-5-20250929';
    }

    /**
     * Generate questions for a specific topic and difficulty
     */
    async generateQuestions(params) {
        const {
            topic,
            subtopic = null,
            difficulty = 'medium',
            gradeLevel = 8,
            count = 5,
            personality = 'nexon',
            questionType = 'mixed'
        } = params;

        console.log(`🤖 [AI Generator] Generating ${count} questions:`, {
            topic,
            difficulty,
            gradeLevel,
            personality
        });

        try {
            // Get personality profile for context
            const personalityProfile = await this.getPersonalityProfile(personality);

            // Generate questions using Claude
            const questions = await this.generateWithClaude({
                topic,
                subtopic,
                difficulty,
                gradeLevel,
                count,
                personality: personalityProfile,
                questionType
            });

            // Save questions to database
            const savedQuestions = await this.saveGeneratedQuestions(questions, params);

            console.log(`✅ [AI Generator] Successfully generated ${savedQuestions.length} questions`);
            return savedQuestions;
        } catch (error) {
            console.error('❌ [AI Generator] Error:', error);
            throw error;
        }
    }

    /**
     * Generate questions using Claude API
     */
    async generateWithClaude(params) {
        const {
            topic,
            subtopic,
            difficulty,
            gradeLevel,
            count,
            personality,
            questionType
        } = params;

        const prompt = this.buildGenerationPrompt({
            topic,
            subtopic,
            difficulty,
            gradeLevel,
            count,
            personality,
            questionType
        });

        try {
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 4000,
                temperature: 0.7,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            const content = response.content[0].text;

            // Parse the JSON response
            const questions = this.parseClaudeResponse(content);

            return questions;
        } catch (error) {
            console.error('❌ [Claude API] Error:', error);
            throw new Error(`Failed to generate questions: ${error.message}`);
        }
    }

    /**
     * Build generation prompt for Claude
     */
    buildGenerationPrompt(params) {
        const {
            topic,
            subtopic,
            difficulty,
            gradeLevel,
            count,
            personality,
            questionType
        } = params;

        const difficultyDescriptions = {
            easy: 'שאלות פשוטות וישירות, מתאימות לתלמידים בתחילת הלמידה',
            medium: 'שאלות בינוניות הדורשות הבנה והפעלת שיקול דעת',
            hard: 'שאלות מאתגרות הדורשות חשיבה יצירתית ופתרון בעיות'
        };

        const questionTypeDescriptions = {
            'calculation': 'תרגילי חישוב ישירים',
            'word_problem': 'בעיות מילוליות מהחיים',
            'puzzle': 'חידות מתמטיות',
            'mixed': 'שילוב של סוגי שאלות שונים'
        };

        return `אתה מורה למתמטיקה מומחה שיוצר שאלות מתמטיות איכותיות בעברית.

📚 **פרטי השאלות הנדרשות:**
- נושא: ${topic}${subtopic ? ` (תת-נושא: ${subtopic})` : ''}
- רמת קושי: ${difficulty} - ${difficultyDescriptions[difficulty]}
- כיתה: ${gradeLevel}
- כמות שאלות: ${count}
- סוג שאלות: ${questionTypeDescriptions[questionType] || 'מעורב'}

👤 **אישיות המורה:** ${personality.display_name_he}
${personality.description}

סגנון הסבר: ${personality.explanation_style}
סגנון משוב: ${personality.feedback_style}
${personality.traits ? `תכונות: ${JSON.stringify(personality.traits)}` : ''}

🎯 **דרישות:**
1. כל שאלה חייבת להיות בעברית תקנית וברורה
2. השאלות יהיו רלוונטיות לתוכנית הלימודים הישראלית
3. כלול הסברים מפורטים עם צעדי פתרון
4. התאם את סגנון השאלה לאישיות המורה
5. וודא שרמת הקושי מתאימה לכיתה ${gradeLevel}
6. כלול רמזים הדרגתיים (hints) לכל שאלה

📝 **פורמט התשובה:**
החזר מערך JSON בלבד, ללא טקסט נוסף, בפורמט הבא:

\`\`\`json
{
  "questions": [
    {
      "question_text": "נוסח השאלה המלא",
      "question_type": "calculation|word_problem|puzzle|multiple_choice",
      "correct_answer": "התשובה הנכונה",
      "wrong_answers": ["תשובה שגויה 1", "תשובה שגויה 2", "תשובה שגויה 3"],
      "explanation": "הסבר מפורט של הפתרון",
      "solution_steps": [
        "צעד 1: תיאור הצעד הראשון",
        "צעד 2: תיאור הצעד השני",
        "צעד 3: התוצאה הסופית"
      ],
      "hints": [
        "רמז 1: עדין מאוד",
        "רמז 2: יותר ספציפי",
        "רמז 3: כמעט מגלה את הפתרון"
      ],
      "cognitive_level": "remember|understand|apply|analyze|evaluate|create",
      "keywords": ["מילת מפתח 1", "מילת מפתח 2"]
    }
  ]
}
\`\`\`

⚠️ **חשוב:** 
- אל תוסיף טקסט מחוץ ל-JSON
- ודא ש-JSON תקין וניתן לפרסור
- השתמש בגרשיים כפולים בלבד
- השאלות יהיו מגוונות ומעניינות

צור עכשיו ${count} שאלות איכותיות! 🚀`;
    }

    /**
     * Parse Claude's response
     */
    parseClaudeResponse(content) {
        try {
            // Try to extract JSON from markdown code blocks
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
            const jsonStr = jsonMatch ? jsonMatch[1] : content;

            const parsed = JSON.parse(jsonStr);

            if (!parsed.questions || !Array.isArray(parsed.questions)) {
                throw new Error('Invalid response format: missing questions array');
            }

            return parsed.questions;
        } catch (error) {
            console.error('❌ [Parser] Failed to parse Claude response:', error);
            console.log('📄 [Parser] Raw content:', content);
            throw new Error(`Failed to parse AI response: ${error.message}`);
        }
    }

    /**
     * Get personality profile from database
     */
    async getPersonalityProfile(personalityName) {
        const query = `
            SELECT * FROM personality_profiles 
            WHERE name = $1 AND is_active = true
            LIMIT 1
        `;

        const result = await pool.query(query, [personalityName]);

        if (result.rows.length === 0) {
            // Return default profile
            return {
                name: 'nexon',
                display_name_he: 'נקסון',
                description: 'מורה מדעי וידידותי',
                explanation_style: 'detailed',
                feedback_style: 'encouraging',
                traits: { humor: 0.5, formality: 0.4, encouragement: 0.9 }
            };
        }

        return result.rows[0];
    }

    /**
     * Save generated questions to database
     */
    async saveGeneratedQuestions(questions, params) {
        const saved = [];

        for (const question of questions) {
            try {
                const questionId = await this.saveQuestion({
                    ...question,
                    topic: params.topic,
                    subtopic: params.subtopic,
                    grade_level: params.gradeLevel,
                    difficulty: params.difficulty,
                    source: 'ai_generated',
                    suitable_for_personalities: [params.personality],
                    quality_score: 75 // AI-generated start with good score
                });

                saved.push({ ...question, id: questionId });
            } catch (error) {
                console.error('❌ [Save] Failed to save question:', error.message);
            }
        }

        return saved;
    }

    /**
     * Save single question to database
     */
    async saveQuestion(question) {
        const query = `
            INSERT INTO question_bank (
                question_text, question_type, topic, subtopic, grade_level,
                difficulty, correct_answer, wrong_answers, explanation,
                solution_steps, hints, source, cognitive_level, keywords,
                suitable_for_personalities, quality_score, is_verified
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id
        `;

        const values = [
            question.question_text,
            question.question_type || 'open_ended',
            question.topic,
            question.subtopic || null,
            question.grade_level,
            question.difficulty,
            question.correct_answer,
            JSON.stringify(question.wrong_answers || []),
            question.explanation || '',
            JSON.stringify(question.solution_steps || []),
            JSON.stringify(question.hints || []),
            question.source || 'ai_generated',
            question.cognitive_level || 'apply',
            question.keywords || [],
            question.suitable_for_personalities || ['nexon'],
            question.quality_score || 75,
            false // AI questions need verification
        ];

        const result = await pool.query(query, values);
        return result.rows[0].id;
    }

    /**
     * Generate questions for weak topics
     */
    async generateForWeakTopics(userId, count = 10) {
        console.log(`🎯 [AI Generator] Generating questions for weak topics - User: ${userId}`);

        try {
            // Get user's weak topics
            const weakTopics = await this.getUserWeakTopics(userId);

            if (weakTopics.length === 0) {
                console.log('ℹ️ [AI Generator] No weak topics found');
                return [];
            }

            const allQuestions = [];

            for (const topicData of weakTopics.slice(0, 3)) { // Top 3 weak topics
                const questionsPerTopic = Math.ceil(count / Math.min(weakTopics.length, 3));

                const questions = await this.generateQuestions({
                    topic: topicData.topic,
                    difficulty: this.adjustDifficultyForWeakTopic(topicData.accuracy),
                    gradeLevel: topicData.grade_level || 8,
                    count: questionsPerTopic,
                    personality: topicData.personality || 'nexon'
                });

                allQuestions.push(...questions);
            }

            return allQuestions;
        } catch (error) {
            console.error('❌ [AI Generator] Error generating for weak topics:', error);
            return [];
        }
    }

    /**
     * Get user's weak topics
     */
    async getUserWeakTopics(userId) {
        const query = `
            SELECT 
                qb.topic,
                qb.grade_level,
                COUNT(*) as total_questions,
                SUM(CASE WHEN sqh.is_correct THEN 1 ELSE 0 END) as correct_answers,
                ROUND(AVG(CASE WHEN sqh.is_correct THEN 100.0 ELSE 0.0 END), 2) as accuracy
            FROM student_question_history sqh
            JOIN question_bank qb ON sqh.question_id = qb.id
            WHERE sqh.user_id = $1
            AND sqh.created_at >= NOW() - INTERVAL '30 days'
            GROUP BY qb.topic, qb.grade_level
            HAVING AVG(CASE WHEN sqh.is_correct THEN 100.0 ELSE 0.0 END) < 70
            ORDER BY accuracy ASC, total_questions DESC
            LIMIT 5
        `;

        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    /**
     * Adjust difficulty based on performance
     */
    adjustDifficultyForWeakTopic(accuracy) {
        if (accuracy < 40) return 'easy';
        if (accuracy < 60) return 'medium';
        return 'medium'; // Keep medium even for weak topics
    }

    /**
     * Regenerate question with different approach
     */
    async regenerateQuestion(questionId, reason = 'student_request') {
        console.log(`🔄 [AI Generator] Regenerating question ${questionId} - Reason: ${reason}`);

        try {
            // Get original question
            const query = `SELECT * FROM question_bank WHERE id = $1`;
            const result = await pool.query(query, [questionId]);

            if (result.rows.length === 0) {
                throw new Error('Question not found');
            }

            const original = result.rows[0];

            // Generate new version
            const newQuestions = await this.generateQuestions({
                topic: original.topic,
                subtopic: original.subtopic,
                difficulty: original.difficulty,
                gradeLevel: original.grade_level,
                count: 1,
                personality: original.suitable_for_personalities[0] || 'nexon'
            });

            if (newQuestions.length > 0) {
                console.log('✅ [AI Generator] Question regenerated successfully');
                return newQuestions[0];
            }

            return null;
        } catch (error) {
            console.error('❌ [AI Generator] Regeneration failed:', error);
            return null;
        }
    }

    /**
     * Get generation statistics
     */
    async getGenerationStats() {
        const query = `
            SELECT 
                topic,
                difficulty,
                COUNT(*) as total_generated,
                AVG(quality_score) as avg_quality,
                SUM(usage_count) as total_usage,
                AVG(success_rate) as avg_success_rate
            FROM question_bank
            WHERE source = 'ai_generated'
            GROUP BY topic, difficulty
            ORDER BY total_generated DESC
        `;

        const result = await pool.query(query);
        return result.rows;
    }
}

module.exports = new AIQuestionGenerator();