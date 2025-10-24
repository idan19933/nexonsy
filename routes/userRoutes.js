// server/routes/userRoutes.js
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Get database ID from Firebase UID (auto-create if not exists)
router.get('/db-id/:firebaseUid', async (req, res) => {
    try {
        const { firebaseUid } = req.params;

        console.log('🔍 Looking up user:', firebaseUid);

        const client = await pool.connect();

        try {
            // Try to find existing user
            let result = await client.query(
                'SELECT id FROM users WHERE firebase_uid = $1',
                [firebaseUid]
            );

            if (result.rows.length === 0) {
                console.log('⚠️ User not found, creating...');

                // Auto-create user
                result = await client.query(
                    'INSERT INTO users (firebase_uid) VALUES ($1) RETURNING id',
                    [firebaseUid]
                );

                console.log('✅ Created user ID:', result.rows[0].id);
            } else {
                console.log('✅ Found user ID:', result.rows[0].id);
            }

            client.release();

            res.json({
                success: true,
                userId: result.rows[0].id
            });

        } catch (error) {
            client.release();
            throw error;
        }

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;