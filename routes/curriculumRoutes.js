import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/progress/record', async (req, res) => {
    try {
        const { userId, topicId, subtopicId, topic, subtopic, correct, timeSpent, hintsUsed = 0, attempts = 1 } = req.body;

        console.log('📊 Recording progress:', { userId, topic, subtopic, correct });

        if (!userId) {
            return res.status(400).json({ success: false, error: 'User ID is required' });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const gradeResult = await client.query('SELECT grade FROM student_profiles WHERE user_id = $1', [userId]);
            const gradeId = gradeResult.rows[0]?.grade || 'grade_8';

            if (topicId) {
                await client.query(`
                    INSERT INTO topic_progress (user_id, grade_id, topic_id, exercises_completed, exercises_correct, total_time_minutes, status, last_activity)
                    VALUES ($1, $2, $3, 1, $4, $5, 'in_progress', CURRENT_TIMESTAMP)
                        ON CONFLICT (user_id, grade_id, topic_id) 
                    DO UPDATE SET
                        exercises_completed = topic_progress.exercises_completed + 1,
                                                   exercises_correct = topic_progress.exercises_correct + $4,
                                                   total_time_minutes = topic_progress.total_time_minutes + $5,
                                                   last_activity = CURRENT_TIMESTAMP,
                                                   progress_percent = LEAST(100, ROUND((topic_progress.exercises_correct + $4)::DECIMAL / (topic_progress.exercises_completed + 1) * 100))
                `, [userId, gradeId, topicId, correct ? 1 : 0, Math.floor(timeSpent / 60000)]);
            }

            if (subtopicId && topicId) {
                await client.query(`
                    INSERT INTO subtopic_progress (user_id, grade_id, topic_id, subtopic_id, exercises_attempted, exercises_correct, hints_used, average_time_seconds, status, last_practice)
                    VALUES ($1, $2, $3, $4, 1, $5, $6, $7, 'in_progress', CURRENT_TIMESTAMP)
                        ON CONFLICT (user_id, grade_id, topic_id, subtopic_id)
                    DO UPDATE SET
                        exercises_attempted = subtopic_progress.exercises_attempted + 1,
                                                   exercises_correct = subtopic_progress.exercises_correct + $5,
                                                   hints_used = subtopic_progress.hints_used + $6,
                                                   average_time_seconds = ROUND((subtopic_progress.average_time_seconds * subtopic_progress.exercises_attempted + $7) / (subtopic_progress.exercises_attempted + 1)),
                                                   last_practice = CURRENT_TIMESTAMP,
                                                   mastery_level = LEAST(100, ROUND((subtopic_progress.exercises_correct + $5)::DECIMAL / (subtopic_progress.exercises_attempted + 1) * 100))
                `, [userId, gradeId, topicId, subtopicId, correct ? 1 : 0, hintsUsed, Math.floor(timeSpent / 1000)]);
            }

            await client.query('COMMIT');
            console.log('✅ Progress recorded');
            res.json({ success: true, message: 'Progress recorded successfully' });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Error recording progress:', error);
        res.status(500).json({ success: false, error: 'Failed to record progress' });
    }
});

router.get('/stats/topics/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        console.log('📊 Fetching topic stats for userId:', userId);

        // Check if table exists first
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'topic_progress'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('⚠️ Table topic_progress does not exist - returning empty data');
            return res.json({
                success: true,
                topics: []
            });
        }

        const result = await pool.query(`
            SELECT 
                topic_id, 
                grade_id, 
                progress_percent, 
                exercises_completed, 
                exercises_correct, 
                total_time_minutes, 
                status, 
                last_activity,
                CASE 
                    WHEN exercises_completed > 0 
                    THEN ROUND((exercises_correct::DECIMAL / exercises_completed) * 100, 1) 
                    ELSE 0 
                END as accuracy
            FROM topic_progress 
            WHERE user_id = $1 
            ORDER BY last_activity DESC
        `, [userId]);

        console.log(`✅ Found ${result.rows.length} topic records`);

        res.json({
            success: true,
            topics: result.rows
        });

    } catch (error) {
        console.error('❌ Error fetching topic stats:', error.message);
        console.error('Stack:', error.stack);

        // Return empty array instead of error
        res.json({
            success: true,
            topics: [],
            error: error.message
        });
    }
});

router.get('/stats/subtopics/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { topicId } = req.query;

        console.log('📊 Fetching subtopic stats for userId:', userId, 'topicId:', topicId);

        // Check if table exists first
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'subtopic_progress'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('⚠️ Table subtopic_progress does not exist - returning empty data');
            return res.json({
                success: true,
                subtopics: []
            });
        }

        let query = `
            SELECT 
                topic_id, 
                subtopic_id, 
                mastery_level, 
                exercises_attempted, 
                exercises_correct, 
                hints_used, 
                average_time_seconds, 
                status, 
                last_practice 
            FROM subtopic_progress 
            WHERE user_id = $1
        `;

        const params = [userId];

        if (topicId) {
            query += ` AND topic_id = $2`;
            params.push(topicId);
        }

        query += ` ORDER BY last_practice DESC`;

        const result = await pool.query(query, params);

        console.log(`✅ Found ${result.rows.length} subtopic records`);

        res.json({
            success: true,
            subtopics: result.rows
        });

    } catch (error) {
        console.error('❌ Error fetching subtopic stats:', error.message);
        console.error('Stack:', error.stack);

        // Return empty array instead of error
        res.json({
            success: true,
            subtopics: [],
            error: error.message
        });
    }
});

router.get('/stats/overall/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        console.log('📊 Fetching overall stats for userId:', userId);

        // Check if view exists first
        const viewCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.views 
                WHERE table_name = 'student_progress_summary'
            );
        `);

        if (!viewCheck.rows[0].exists) {
            console.log('⚠️ View student_progress_summary does not exist - returning default data');
            return res.json({
                success: true,
                stats: {
                    total_topics: 0,
                    completed_topics: 0,
                    total_exercises: 0,
                    total_correct: 0,
                    success_rate: 0
                }
            });
        }

        const result = await pool.query(`
            SELECT * 
            FROM student_progress_summary 
            WHERE user_id = $1
        `, [userId]);

        console.log('✅ Overall stats fetched');

        res.json({
            success: true,
            stats: result.rows[0] || {
                total_topics: 0,
                completed_topics: 0,
                total_exercises: 0,
                total_correct: 0,
                success_rate: 0
            }
        });

    } catch (error) {
        console.error('❌ Error fetching overall stats:', error.message);
        console.error('Stack:', error.stack);

        // Return default stats instead of error
        res.json({
            success: true,
            stats: {
                total_topics: 0,
                completed_topics: 0,
                total_exercises: 0,
                total_correct: 0,
                success_rate: 0
            },
            error: error.message
        });
    }
});

export default router;