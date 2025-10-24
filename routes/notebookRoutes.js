// server/routes/notebookRoutes.js - DEDICATED NOTEBOOK ROUTES
import express from 'express';
import notebookService from '../services/notebookService.js';

const router = express.Router();

// ==================== SAVE EXERCISE TO NOTEBOOK ====================
router.post('/save-exercise', async (req, res) => {
    try {
        const { userId, exerciseData } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID required'
            });
        }

        if (!exerciseData || !exerciseData.question) {
            return res.status(400).json({
                success: false,
                error: 'Exercise data required'
            });
        }

        console.log(`📝 Saving exercise to notebook for user ${userId}`);
        const result = await notebookService.saveExerciseToNotebook(userId, exerciseData);

        res.json(result);
    } catch (error) {
        console.error('❌ Save exercise route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== GET ALL ENTRIES ====================
router.get('/entries', async (req, res) => {
    try {
        const userId = req.query.userId;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID required'
            });
        }

        const filters = {
            topic: req.query.topic,
            type: req.query.type
        };

        const result = await notebookService.getEntries(userId, filters);
        res.json(result);
    } catch (error) {
        console.error('❌ Get entries route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== GET RECENT ENTRIES ====================
router.get('/recent', async (req, res) => {
    try {
        const userId = req.query.userId;
        const limit = parseInt(req.query.limit) || 5;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID required'
            });
        }

        const result = await notebookService.getRecentEntries(userId, limit);
        res.json(result);
    } catch (error) {
        console.error('❌ Recent entries route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== GET STATS ====================
router.get('/stats', async (req, res) => {
    try {
        const userId = req.query.userId;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID required'
            });
        }

        const result = await notebookService.getStats(userId);
        res.json(result);
    } catch (error) {
        console.error('❌ Notebook stats route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== ADD GENERIC ENTRY ====================
router.post('/add', async (req, res) => {
    try {
        const { userId, entryData } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID required'
            });
        }

        const result = await notebookService.addEntry(userId, entryData);
        res.json(result);
    } catch (error) {
        console.error('❌ Add entry route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== DELETE ENTRY ====================
router.delete('/entry/:id', async (req, res) => {
    try {
        const userId = req.body.userId || req.query.userId;
        const entryId = req.params.id;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID required'
            });
        }

        const result = await notebookService.deleteEntry(entryId, userId);
        res.json(result);
    } catch (error) {
        console.error('❌ Delete entry route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== GET ENTRIES BY TOPIC ====================
router.get('/topic/:topicId', async (req, res) => {
    try {
        const userId = req.query.userId;
        const topicId = req.params.topicId;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID required'
            });
        }

        const result = await notebookService.getEntriesByTopic(userId, topicId);
        res.json(result);
    } catch (error) {
        console.error('❌ Get topic entries route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== BATCH SAVE EXERCISES ====================
router.post('/batch-save', async (req, res) => {
    try {
        const { userId, exercises } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID required'
            });
        }

        if (!Array.isArray(exercises) || exercises.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Exercises array required'
            });
        }

        const result = await notebookService.batchSaveExercises(userId, exercises);
        res.json(result);
    } catch (error) {
        console.error('❌ Batch save route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;