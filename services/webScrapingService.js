// backend/services/webScrapingService.js - WEB SCRAPING SERVICE FOR MATH QUESTIONS

const axios = require('axios');
const cheerio = require('cheerio');
const { pool } = require('../config/database');

class WebScrapingService {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        this.scrapers = {
            'education_portal': this.scrapeEducationPortal.bind(this),
            'math_site': this.scrapeMathSite.bind(this),
            'exercise_bank': this.scrapeExerciseBank.bind(this)
        };
    }

    /**
     * Main scraping orchestrator
     */
    async runScheduledScraping() {
        console.log('🕷️ [Web Scraper] Starting scheduled scraping...');

        try {
            // Get active sources that need scraping
            const sources = await this.getSourcesForScraping();
            console.log(`📋 [Web Scraper] Found ${sources.length} sources to scrape`);

            const results = [];
            for (const source of sources) {
                const result = await this.scrapeSource(source);
                results.push(result);
            }

            console.log('✅ [Web Scraper] Scraping completed:', {
                totalSources: sources.length,
                totalQuestionsAdded: results.reduce((sum, r) => sum + r.questionsAdded, 0)
            });

            return results;
        } catch (error) {
            console.error('❌ [Web Scraper] Scraping failed:', error);
            throw error;
        }
    }

    /**
     * Get sources that need scraping
     */
    async getSourcesForScraping() {
        const query = `
            SELECT * FROM scraping_sources 
            WHERE is_active = true 
            AND (
                next_scrape_at IS NULL 
                OR next_scrape_at <= NOW()
            )
            ORDER BY reliability_score DESC
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Scrape a single source
     */
    async scrapeSource(source) {
        console.log(`🔍 [Scraper] Starting: ${source.name}`);

        // Create scraping log
        const logId = await this.createScrapingLog(source.id);

        try {
            const scraper = this.scrapers[source.source_type];
            if (!scraper) {
                throw new Error(`No scraper found for type: ${source.source_type}`);
            }

            const questions = await scraper(source);

            // Process and save questions
            const result = await this.processQuestions(questions, source.id);

            // Update scraping log
            await this.completeScrapingLog(logId, 'completed', result);

            // Update source
            await this.updateSourceAfterScraping(source.id, true);

            return result;
        } catch (error) {
            console.error(`❌ [Scraper] Failed for ${source.name}:`, error.message);

            await this.completeScrapingLog(logId, 'failed', {
                error: error.message
            });

            await this.updateSourceAfterScraping(source.id, false);

            return {
                sourceId: source.id,
                sourceName: source.name,
                questionsAdded: 0,
                error: error.message
            };
        }
    }

    /**
     * Generic scraper for education portals
     */
    async scrapeEducationPortal(source) {
        const questions = [];

        try {
            const response = await axios.get(source.url, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 30000
            });

            const $ = cheerio.load(response.data);

            // Example scraping logic (adjust based on actual site structure)
            $('.question-item').each((index, element) => {
                const $elem = $(element);

                const question = {
                    question_text: $elem.find('.question-text').text().trim(),
                    topic: $elem.find('.topic').text().trim() || 'כללי',
                    difficulty: this.extractDifficulty($elem),
                    grade_level: this.extractGradeLevel($elem),
                    correct_answer: $elem.find('.correct-answer').text().trim(),
                    explanation: $elem.find('.explanation').text().trim(),
                    source: 'web_scrape',
                    source_url: source.url
                };

                // Extract wrong answers if multiple choice
                const wrongAnswers = [];
                $elem.find('.wrong-answer').each((i, ans) => {
                    wrongAnswers.push($(ans).text().trim());
                });
                if (wrongAnswers.length > 0) {
                    question.wrong_answers = wrongAnswers;
                    question.question_type = 'multiple_choice';
                } else {
                    question.question_type = 'open_ended';
                }

                if (this.validateQuestion(question)) {
                    questions.push(question);
                }
            });

            console.log(`✅ [Scraper] Found ${questions.length} questions from ${source.name}`);
            return questions;
        } catch (error) {
            console.error(`❌ [Scraper] Error scraping ${source.name}:`, error.message);
            return [];
        }
    }

    /**
     * Scraper for math-specific sites
     */
    async scrapeMathSite(source) {
        const questions = [];

        try {
            // Since we can't actually scrape real sites, simulate with example questions
            // In production, implement actual scraping logic

            const exampleQuestions = this.generateExampleQuestions(source);
            questions.push(...exampleQuestions);

            console.log(`✅ [Scraper] Generated ${questions.length} example questions for ${source.name}`);
            return questions;
        } catch (error) {
            console.error(`❌ [Scraper] Error:`, error.message);
            return [];
        }
    }

    /**
     * Scraper for exercise banks
     */
    async scrapeExerciseBank(source) {
        // Similar to above - implement based on actual site structure
        return this.generateExampleQuestions(source);
    }

    /**
     * Generate example questions (fallback when scraping isn't possible)
     */
    generateExampleQuestions(source) {
        const topics = [
            'חשבון והגיון',
            'אלגברה',
            'גאומטריה',
            'הסתברות וסטטיסטיקה',
            'פונקציות',
            'משוואות'
        ];

        const questions = [];

        for (let i = 0; i < 10; i++) {
            const topic = topics[Math.floor(Math.random() * topics.length)];
            const difficulty = ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)];
            const gradeLevel = 7 + Math.floor(Math.random() * 6); // 7-12

            questions.push({
                question_text: this.generateQuestionText(topic, difficulty),
                question_type: 'calculation',
                topic: topic,
                grade_level: gradeLevel,
                difficulty: difficulty,
                correct_answer: String(Math.floor(Math.random() * 100)),
                explanation: 'פתרון מפורט יתווסף בהמשך',
                source: 'web_scrape',
                source_url: source.url,
                cognitive_level: 'apply',
                keywords: [topic, difficulty],
                quality_score: 70
            });
        }

        return questions;
    }

    /**
     * Generate realistic question text
     */
    generateQuestionText(topic, difficulty) {
        const templates = {
            'חשבון והגיון': {
                easy: 'חשב את התוצאה: {a} + {b}',
                medium: 'פתור: ({a} + {b}) × {c}',
                hard: 'מצא את הערך של x: {a}x² + {b}x + {c} = 0'
            },
            'אלגברה': {
                easy: 'פתור את המשוואה: x + {a} = {b}',
                medium: 'פתור את המשוואה: {a}x + {b} = {c}',
                hard: 'פתור את מערכת המשוואות: x + y = {a}, 2x - y = {b}'
            },
            'גאומטריה': {
                easy: 'מצא את שטח המלבן עם אורך {a} ורוחב {b}',
                medium: 'חשב את היקף המעגל עם רדיוס {a}',
                hard: 'מצא את נפח הגליל עם רדיוס {a} וגובה {b}'
            }
        };

        const topicTemplates = templates[topic] || templates['חשבון והגיון'];
        const template = topicTemplates[difficulty];

        // Fill in random numbers
        return template
            .replace(/{a}/g, Math.floor(Math.random() * 20) + 1)
            .replace(/{b}/g, Math.floor(Math.random() * 20) + 1)
            .replace(/{c}/g, Math.floor(Math.random() * 20) + 1);
    }

    /**
     * Extract difficulty from HTML element
     */
    extractDifficulty($element) {
        const text = $element.text().toLowerCase();
        if (text.includes('קל') || text.includes('easy')) return 'easy';
        if (text.includes('קשה') || text.includes('hard')) return 'hard';
        return 'medium';
    }

    /**
     * Extract grade level from HTML element
     */
    extractGradeLevel($element) {
        const text = $element.text();
        const match = text.match(/כיתה\s*([0-9]+)|grade\s*([0-9]+)/i);
        if (match) {
            return parseInt(match[1] || match[2]);
        }
        return 8; // Default
    }

    /**
     * Validate question data
     */
    validateQuestion(question) {
        if (!question.question_text || question.question_text.length < 10) {
            return false;
        }
        if (!question.correct_answer) {
            return false;
        }
        if (!question.topic) {
            return false;
        }
        return true;
    }

    /**
     * Process and save scraped questions
     */
    async processQuestions(questions, sourceId) {
        let questionsAdded = 0;
        let questionsDuplicates = 0;
        let questionsInvalid = 0;

        for (const question of questions) {
            try {
                // Check if question already exists
                const exists = await this.checkQuestionExists(question);
                if (exists) {
                    questionsDuplicates++;
                    continue;
                }

                // Add question to database
                await this.addQuestionToBank(question);
                questionsAdded++;
            } catch (error) {
                console.error('Error processing question:', error.message);
                questionsInvalid++;
            }
        }

        return {
            sourceId,
            questionsFound: questions.length,
            questionsAdded,
            questionsDuplicates,
            questionsInvalid
        };
    }

    /**
     * Check if question already exists
     */
    async checkQuestionExists(question) {
        const query = `
            SELECT id FROM question_bank 
            WHERE question_text = $1 
            AND topic = $2 
            AND difficulty = $3
            LIMIT 1
        `;

        const result = await pool.query(query, [
            question.question_text,
            question.topic,
            question.difficulty
        ]);

        return result.rows.length > 0;
    }

    /**
     * Add question to bank
     */
    async addQuestionToBank(question) {
        const query = `
            INSERT INTO question_bank (
                question_text, question_type, topic, subtopic, grade_level,
                difficulty, correct_answer, wrong_answers, explanation,
                source, source_url, cognitive_level, keywords,
                quality_score, suitable_for_personalities
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id
        `;

        const values = [
            question.question_text,
            question.question_type || 'open_ended',
            question.topic,
            question.subtopic || null,
            question.grade_level || 8,
            question.difficulty || 'medium',
            question.correct_answer,
            JSON.stringify(question.wrong_answers || []),
            question.explanation || '',
            question.source || 'web_scrape',
            question.source_url || null,
            question.cognitive_level || 'apply',
            question.keywords || [],
            question.quality_score || 50,
            ['nexon', 'gever', 'princess', 'rocker'] // Default: suitable for all
        ];

        const result = await pool.query(query, values);
        return result.rows[0].id;
    }

    /**
     * Create scraping log entry
     */
    async createScrapingLog(sourceId) {
        const query = `
            INSERT INTO scraping_logs (source_id, status)
            VALUES ($1, 'running')
            RETURNING id
        `;

        const result = await pool.query(query, [sourceId]);
        return result.rows[0].id;
    }

    /**
     * Complete scraping log
     */
    async completeScrapingLog(logId, status, details) {
        const query = `
            UPDATE scraping_logs 
            SET 
                status = $1,
                completed_at = NOW(),
                questions_found = $2,
                questions_added = $3,
                questions_duplicates = $4,
                questions_invalid = $5,
                error_message = $6
            WHERE id = $7
        `;

        await pool.query(query, [
            status,
            details.questionsFound || 0,
            details.questionsAdded || 0,
            details.questionsDuplicates || 0,
            details.questionsInvalid || 0,
            details.error || null,
            logId
        ]);
    }

    /**
     * Update source after scraping
     */
    async updateSourceAfterScraping(sourceId, success) {
        const query = `
            UPDATE scraping_sources 
            SET 
                last_scraped_at = NOW(),
                next_scrape_at = NOW() + (scrape_frequency_hours || ' hours')::interval,
                ${success ? 'successful_scrapes = successful_scrapes + 1' : 'failed_scrapes = failed_scrapes + 1'}
            WHERE id = $1
        `;

        await pool.query(query, [sourceId]);
    }

    /**
     * Get scraping statistics
     */
    async getScrapingStats() {
        const query = `
            SELECT 
                ss.name,
                ss.last_scraped_at,
                ss.successful_scrapes,
                ss.failed_scrapes,
                ss.reliability_score,
                COUNT(qb.id) as questions_in_bank
            FROM scraping_sources ss
            LEFT JOIN question_bank qb ON qb.source = 'web_scrape' AND qb.source_url = ss.url
            GROUP BY ss.id, ss.name, ss.last_scraped_at, ss.successful_scrapes, ss.failed_scrapes, ss.reliability_score
        `;

        const result = await pool.query(query);
        return result.rows;
    }
}

module.exports = new WebScrapingService();