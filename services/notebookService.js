// server/services/notebookService.js - COMPLETE WITH ALL METHODS
import pool from '../config/database.js';

class NotebookService {
    // ==================== SAVE EXERCISE ====================
    async saveExerciseToNotebook(studentId, exerciseData) {
        const query = `
            INSERT INTO notebook_entries (
                student_id, type, topic, subtopic, title, summary, content
            )
            VALUES ($1, 'exercise', $2, $3, $4, $5, $6)
                RETURNING *
        `;

        try {
            const title = exerciseData.question.substring(0, 100) + '...';
            const summary = exerciseData.isCorrect
                ? '✅ פתרון נכון!'
                : '📝 צריך חזרה בנושא';

            const content = {
                question: exerciseData.question,
                answer: exerciseData.answer,
                studentAnswer: exerciseData.studentAnswer,
                isCorrect: exerciseData.isCorrect,
                timestamp: new Date().toISOString()
            };

            const result = await pool.query(query, [
                studentId,
                exerciseData.topic || 'כללי',
                exerciseData.subtopic || '',
                title,
                summary,
                JSON.stringify(content)
            ]);

            console.log('✅ Saved to notebook:', result.rows[0].id);
            return { success: true, entry: result.rows[0] };
        } catch (error) {
            console.error('❌ Notebook save error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== ADD ENTRY (GENERIC) ====================
    async addEntry(studentId, entryData) {
        const query = `
            INSERT INTO notebook_entries (
                student_id, type, topic, subtopic, title, summary, content
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
        `;

        try {
            const result = await pool.query(query, [
                studentId,
                entryData.type || 'note',
                entryData.topic || 'כללי',
                entryData.subtopic || '',
                entryData.title || 'רשימה חדשה',
                entryData.summary || '',
                JSON.stringify(entryData.content || {})
            ]);

            console.log('✅ Added entry:', result.rows[0].id);
            return { success: true, entry: result.rows[0] };
        } catch (error) {
            console.error('❌ Add entry error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== GET ALL ENTRIES ====================
    async getEntries(studentId, filters = {}) {
        let query = `
            SELECT * FROM notebook_entries
            WHERE student_id = $1
        `;
        const values = [studentId];
        let paramCount = 1;

        if (filters.topic) {
            paramCount++;
            query += ` AND topic = $${paramCount}`;
            values.push(filters.topic);
        }

        if (filters.type) {
            paramCount++;
            query += ` AND type = $${paramCount}`;
            values.push(filters.type);
        }

        query += ` ORDER BY created_at DESC LIMIT 50`;

        try {
            const result = await pool.query(query, values);
            console.log(`✅ Retrieved ${result.rows.length} entries for student ${studentId}`);
            return { success: true, entries: result.rows };
        } catch (error) {
            console.error('❌ Get entries error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== GET RECENT ENTRIES ====================
    async getRecentEntries(studentId, limit = 5) {
        const query = `
            SELECT * FROM notebook_entries
            WHERE student_id = $1
            ORDER BY created_at DESC
                LIMIT $2
        `;

        try {
            const result = await pool.query(query, [studentId, limit]);
            console.log(`✅ Retrieved ${result.rows.length} recent entries`);
            return { success: true, entries: result.rows };
        } catch (error) {
            console.error('❌ Get recent entries error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== DELETE ENTRY ====================
    async deleteEntry(entryId, studentId) {
        const query = `
            DELETE FROM notebook_entries
            WHERE id = $1 AND student_id = $2
                RETURNING id
        `;

        try {
            const result = await pool.query(query, [entryId, studentId]);

            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: 'Entry not found or unauthorized'
                };
            }

            console.log(`✅ Deleted entry ${entryId}`);
            return { success: true, deletedId: entryId };
        } catch (error) {
            console.error('❌ Delete entry error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== GET STATS ====================
    async getStats(studentId) {
        try {
            const result = await pool.query(
                `SELECT
                     COUNT(*) as total_entries,
                     COUNT(DISTINCT topic) as topic_count,
                     COUNT(CASE WHEN type = 'exercise' THEN 1 END) as exercise_count
                 FROM notebook_entries
                 WHERE student_id = $1`,
                [studentId]
            );

            const stats = result.rows[0];

            console.log(`✅ Stats for student ${studentId}:`, {
                total: stats.total_entries,
                topics: stats.topic_count,
                exercises: stats.exercise_count
            });

            return {
                success: true,
                stats: {
                    total_entries: parseInt(stats.total_entries) || 0,
                    topic_count: parseInt(stats.topic_count) || 0,
                    exercise_count: parseInt(stats.exercise_count) || 0
                }
            };
        } catch (error) {
            console.error('❌ Get stats error:', error);
            return {
                success: false,
                error: error.message,
                stats: {
                    total_entries: 0,
                    topic_count: 0,
                    exercise_count: 0
                }
            };
        }
    }

    // ==================== GET ENTRIES BY TOPIC ====================
    async getEntriesByTopic(studentId, topicId) {
        const query = `
            SELECT * FROM notebook_entries
            WHERE student_id = $1 AND topic = $2
            ORDER BY created_at DESC
        `;

        try {
            const result = await pool.query(query, [studentId, topicId]);
            return { success: true, entries: result.rows };
        } catch (error) {
            console.error('❌ Get entries by topic error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== BATCH SAVE (FOR MULTIPLE EXERCISES) ====================
    async batchSaveExercises(studentId, exercises) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const savedEntries = [];
            for (const exercise of exercises) {
                const query = `
                    INSERT INTO notebook_entries (
                        student_id, type, topic, subtopic, title, summary, content
                    )
                    VALUES ($1, 'exercise', $2, $3, $4, $5, $6)
                        RETURNING *
                `;

                const title = exercise.question.substring(0, 100) + '...';
                const summary = exercise.isCorrect ? '✅ נכון' : '❌ שגוי';
                const content = JSON.stringify({
                    question: exercise.question,
                    answer: exercise.answer,
                    studentAnswer: exercise.studentAnswer,
                    isCorrect: exercise.isCorrect,
                    timestamp: new Date().toISOString()
                });

                const result = await client.query(query, [
                    studentId,
                    exercise.topic || 'כללי',
                    exercise.subtopic || '',
                    title,
                    summary,
                    content
                ]);

                savedEntries.push(result.rows[0]);
            }

            await client.query('COMMIT');
            console.log(`✅ Batch saved ${savedEntries.length} exercises`);

            return { success: true, entries: savedEntries };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Batch save error:', error);
            return { success: false, error: error.message };
        } finally {
            client.release();
        }
    }
}

export default new NotebookService();