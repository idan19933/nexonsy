// server/routes/problems.js - COMPLETE ROUTES
import express from 'express';
import { getDatabase } from '../db.js';

const router = express.Router();

// GET /api/problems/health
router.get('/health', async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.get('SELECT COUNT(*) as count FROM problems');
        const topics = await db.all('SELECT DISTINCT topic FROM problems');

        res.json({
            status: 'ok',
            database: 'connected',
            totalProblems: result.count,
            availableTopics: topics.map(t => t.topic)
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            error: error.message
        });
    }
});

// GET /api/problems/stats
router.get('/stats', async (req, res) => {
    try {
        const db = getDatabase();

        const total = await db.get('SELECT COUNT(*) as count FROM problems');
        const byTopic = await db.all('SELECT topic, COUNT(*) as count FROM problems GROUP BY topic');
        const byDifficulty = await db.all('SELECT difficulty, COUNT(*) as count FROM problems GROUP BY difficulty');

        const stats = {
            total: total.count,
            byTopic: {},
            byDifficulty: {}
        };

        byTopic.forEach(row => {
            stats.byTopic[row.topic] = row.count;
        });

        byDifficulty.forEach(row => {
            stats.byDifficulty[row.difficulty] = row.count;
        });

        console.log('📊 Stats:', stats);
        res.json(stats);

    } catch (error) {
        console.error('❌ Stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/problems/random
router.get('/random', async (req, res) => {
    try {
        const db = getDatabase();
        const { topic, difficulty, count = 1 } = req.query;

        let query = 'SELECT * FROM problems WHERE 1=1';
        const params = [];

        if (topic) {
            query += ' AND topic = ?';
            params.push(topic);
        }

        if (difficulty) {
            query += ' AND difficulty = ?';
            params.push(parseInt(difficulty));
        }

        query += ' ORDER BY RANDOM() LIMIT ?';
        params.push(parseInt(count));

        console.log('🔍 Random query:', { topic, difficulty, count });
        const problems = await db.all(query, params);
        console.log(`✅ Found ${problems.length} problems`);

        res.json(problems);

    } catch (error) {
        console.error('❌ Random error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/problems/progressive
router.get('/progressive', async (req, res) => {
    try {
        const db = getDatabase();
        const { topic, difficulties, count = 1 } = req.query;

        let query = 'SELECT * FROM problems WHERE 1=1';
        const params = [];

        if (topic) {
            query += ' AND topic = ?';
            params.push(topic);
        }

        if (difficulties) {
            const diffArray = difficulties.split(',').map(d => parseInt(d));
            const placeholders = diffArray.map(() => '?').join(',');
            query += ` AND difficulty IN (${placeholders})`;
            params.push(...diffArray);
        }

        query += ' ORDER BY RANDOM() LIMIT ?';
        params.push(parseInt(count));

        console.log('🔍 Progressive query:', { topic, difficulties, count });
        const problems = await db.all(query, params);
        console.log(`✅ Found ${problems.length} problems`);

        res.json(problems);

    } catch (error) {
        console.error('❌ Progressive error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/problems (basic query)
router.get('/', async (req, res) => {
    try {
        const db = getDatabase();
        const { topic, difficulty, limit = 10, offset = 0 } = req.query;

        let query = 'SELECT * FROM problems WHERE 1=1';
        const params = [];

        if (topic) {
            query += ' AND topic = ?';
            params.push(topic);
        }

        if (difficulty) {
            query += ' AND difficulty = ?';
            params.push(parseInt(difficulty));
        }

        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const problems = await db.all(query, params);
        console.log(`✅ Query returned ${problems.length} problems`);

        res.json(problems);

    } catch (error) {
        console.error('❌ Query error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/problems/bulk
router.post('/bulk', async (req, res) => {
    try {
        const db = getDatabase();
        const { problems } = req.body;

        if (!problems || !Array.isArray(problems)) {
            return res.status(400).json({ error: 'Invalid problems array' });
        }

        const insertStmt = await db.prepare(`
            INSERT INTO problems (
                question, answer, steps, hints, difficulty, 
                topic, category, subcategory, grade, tier
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let inserted = 0;
        for (const problem of problems) {
            try {
                await insertStmt.run(
                    problem.question,
                    problem.answer,
                    JSON.stringify(problem.steps || []),
                    JSON.stringify(problem.hints || []),
                    problem.difficulty,
                    problem.topic,
                    problem.category,
                    problem.subcategory,
                    problem.grade || '7-12',
                    problem.tier || problem.difficulty
                );
                inserted++;
            } catch (error) {
                console.error('Insert error:', error.message);
            }
        }

        await insertStmt.finalize();
        res.json({ count: inserted, total: problems.length });

    } catch (error) {
        console.error('❌ Bulk insert error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;