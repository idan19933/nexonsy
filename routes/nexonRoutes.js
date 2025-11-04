// server/routes/nexonRoutes.js - NEXONASK CHAT ONLY
import express from 'express';
import nexonAskService from '../services/nexonAskService.js';

const router = express.Router();

// ==================== NEXONASK CHAT ENDPOINTS ====================

/**
 * POST /api/chat/nexon-ask
 * Main NexonAsk chat endpoint
 */
router.post('/chat/nexon-ask', async (req, res) => {
    try {
        const { userId, message } = req.body;

        if (!userId || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing userId or message'
            });
        }

        console.log('💬 NexonAsk request from user:', userId);
        console.log('📝 Message:', message);

        const response = await nexonAskService.generateResponse(userId, message);

        res.json(response);

    } catch (error) {
        console.error('❌ NexonAsk error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate response',
            message: error.message
        });
    }
});

/**
 * GET /api/chat/insights
 * Get student insights for banner
 */
router.get('/chat/insights', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing userId'
            });
        }

        console.log('📊 Fetching insights for:', userId);

        const insights = await nexonAskService.getInsights(userId);

        res.json(insights);

    } catch (error) {
        console.error('❌ Insights error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch insights',
            message: error.message
        });
    }
});

/**
 * GET /api/chat/student-insights (alias for compatibility)
 */
router.get('/chat/student-insights', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing userId'
            });
        }

        console.log('📊 Fetching student insights for:', userId);

        const insights = await nexonAskService.getInsights(userId);

        res.json(insights);

    } catch (error) {
        console.error('❌ Student insights error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch student insights',
            message: error.message
        });
    }
});

export default router;