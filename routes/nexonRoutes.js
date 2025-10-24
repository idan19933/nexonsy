// server/routes/nexonRoutes.js - COMPLETE WITH NOTEBOOK ROUTES
import express from 'express';
import notebookService from '../services/notebookService.js';

const router = express.Router();

// ==================== NOTEBOOK ROUTES ====================

// GET /api/notebook - Get all notebook entries for a user
router.get('/notebook', async (req, res) => {
    try {
        const studentId = req.query.userId || req.user?.id;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                error: 'User ID required'
            });
        }

        const filters = {
            topic: req.query.topic
        };

        const result = await notebookService.getEntries(studentId, filters);
        res.json(result);
    } catch (error) {
        console.error('❌ Notebook route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/notebook/stats - Get statistics about notebook entries
router.get('/notebook/stats', async (req, res) => {
    try {
        const studentId = req.query.userId || req.user?.id;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                error: 'User ID required'
            });
        }

        const result = await notebookService.getStats(studentId);
        res.json(result);
    } catch (error) {
        console.error('❌ Notebook stats route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/notebook - Add a new notebook entry
router.post('/notebook', async (req, res) => {
    try {
        const studentId = req.body.userId || req.user?.id;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                error: 'User ID required'
            });
        }

        const result = await notebookService.addEntry(studentId, req.body);
        res.json(result);
    } catch (error) {
        console.error('❌ Add notebook entry route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/notebook/recent - Get recent entries
router.get('/notebook/recent', async (req, res) => {
    try {
        const studentId = req.query.userId || req.user?.id;
        const limit = parseInt(req.query.limit) || 5;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                error: 'User ID required'
            });
        }

        const result = await notebookService.getRecentEntries(studentId, limit);
        res.json(result);
    } catch (error) {
        console.error('❌ Recent entries route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// DELETE /api/notebook/:id - Delete a notebook entry
router.delete('/notebook/:id', async (req, res) => {
    try {
        const studentId = req.body.userId || req.user?.id;
        const entryId = req.params.id;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                error: 'User ID required'
            });
        }

        const result = await notebookService.deleteEntry(entryId, studentId);
        res.json(result);
    } catch (error) {
        console.error('❌ Delete entry route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== HEALTH CHECK ====================
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Nexon API is running',
        timestamp: new Date().toISOString()
    });
});

export default router;