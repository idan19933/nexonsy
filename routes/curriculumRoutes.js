import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/progress/record', async (req, res) => {
    console.error('========================================');
    console.error('ROUTE CALLED: /progress/record');
    console.error('Body:', req.body);
    console.error('========================================');

    try {
        const { userId, topicId, subtopicId, topic, subtopic, correct, timeSpent, hintsUsed = 0, attempts = 1 } = req.body;

        console.error('📊 Recording progress:', { userId, topic, subtopic, correct });

        if (!userId) {
            return res.status(400).json({ success: false, error: 'User ID is required' });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Use default grade for now
            const gradeId = 'grade_8';

            if (topicId) {
                await client.query(`
                    INSERT INTO topic_progress (student_id, topic_id, mastery_level, created_at, updated_at)
                    VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT (student_id, topic_id) 
                    DO UPDATE SET
                        mastery_level = LEAST(100, topic_progress.mastery_level + $3),
                        updated_at = CURRENT_TIMESTAMP
                `, [userId, topicId, correct ? 5 : 0]);
            }

            if (subtopicId) {
                await client.query(`
                    INSERT INTO subtopic_progress (student_id, subtopic_id, mastery_level, exercises_completed, created_at, updated_at)
                    VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT (student_id, subtopic_id)
                    DO UPDATE SET
                        exercises_completed = subtopic_progress.exercises_completed + 1,
                        mastery_level = LEAST(100, subtopic_progress.mastery_level + $3),
                        updated_at = CURRENT_TIMESTAMP
                `, [userId, subtopicId, correct ? 5 : 0]);
            }

            // Record in curriculum_progress with UPSERT
            await client.query(`
                INSERT INTO curriculum_progress (
                    student_id, grade_id, topic_id, subtopic_id, 
                    mastery_level, attempts, correct_attempts, last_practiced
                )
                VALUES ($1, $2, $3, $4, $5, 1, $6, CURRENT_TIMESTAMP)
                ON CONFLICT (student_id, grade_id, topic_id, subtopic_id) 
                DO UPDATE SET
                    attempts = curriculum_progress.attempts + 1,
                    correct_attempts = curriculum_progress.correct_attempts + $6,
                    mastery_level = LEAST(100, curriculum_progress.mastery_level + $5),
                    last_practiced = CURRENT_TIMESTAMP
            `, [userId, gradeId, topicId, subtopicId, correct ? 5 : 0, correct ? 1 : 0]);

            await client.query('COMMIT');
            console.error('✅ Progress recorded');
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
        console.error('📊 Fetching topic stats for userId:', userId);
        const result = await pool.query(`
            SELECT
                topic_id,
                COUNT(*) as total_exercises,
                SUM(CASE WHEN correct_attempts > 0 THEN 1 ELSE 0 END) as correct_exercises,
                ROUND(AVG(mastery_level), 1) as mastery_level,
                ROUND(
                    AVG(CASE WHEN attempts > 0 THEN (correct_attempts::float / attempts * 100) ELSE 0 END),
                    1
                ) as accuracy,
                ROUND(
                    (SUM(CASE WHEN correct_attempts > 0 THEN 1 ELSE 0 END)::float / COUNT(*) * 100),
                    1
                ) as progress_percent,
                MAX(last_practiced) as last_activity
            FROM curriculum_progress
            WHERE student_id = $1
            GROUP BY topic_id
            ORDER BY last_activity DESC
        `, [userId]);
        console.error(`✅ Found ${result.rows.length} topic records`);
        res.json({ success: true, topics: result.rows });
    } catch (error) {
        console.error('❌ Error fetching topic stats:', error.message);
        res.json({ success: true, topics: [], error: error.message });
    }
});

router.get('/stats/subtopics/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { topicId } = req.query;

        let query = `
            SELECT
                subtopic_id,
                mastery_level,
                exercises_completed,
                updated_at as last_practice
            FROM subtopic_progress
            WHERE student_id = $1
            ORDER BY updated_at DESC
        `;

        const result = await pool.query(query, [userId]);
        console.error(`✅ Found ${result.rows.length} subtopic records`);
        res.json({ success: true, subtopics: result.rows });

    } catch (error) {
        console.error('❌ Error fetching subtopic stats:', error.message);
        res.json({ success: true, subtopics: [], error: error.message });
    }
});

router.get('/stats/overall/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        console.error('📊 Fetching overall stats for userId:', userId);

        const result = await pool.query(`
            SELECT
                COUNT(DISTINCT topic_id) as total_topics,
                SUM(attempts) as total_exercises,
                SUM(correct_attempts) as total_correct
            FROM curriculum_progress
            WHERE student_id = $1
        `, [userId]);

        const stats = result.rows[0] || { total_topics: 0, total_exercises: 0, total_correct: 0 };
        stats.success_rate = stats.total_exercises > 0
            ? Math.round((stats.total_correct / stats.total_exercises) * 100)
            : 0;

        res.json({ success: true, stats });

    } catch (error) {
        console.error('❌ Error fetching overall stats:', error.message);
        res.json({
            success: true,
            stats: { total_topics: 0, total_exercises: 0, total_correct: 0, success_rate: 0 },
            error: error.message
        });
    }
});

export default router;
