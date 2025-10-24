import pool from '../config/database.js';

class CurriculumSyncService {
    /**
     * Initialize progress tracking for a new student
     */
    async initializeStudentProgress(userId, grade, track = null) {
        try {
            // Dynamic import of curriculum
            const { ISRAELI_CURRICULUM, getUserGradeId } = await import('../../src/config/israeliCurriculum.js');

            const gradeId = getUserGradeId(grade, track);
            const curriculumData = ISRAELI_CURRICULUM[gradeId];

            if (!curriculumData) {
                throw new Error(`Curriculum not found for grade: ${gradeId}`);
            }

            console.log(`📚 Initializing progress for user ${userId}, grade: ${gradeId}`);

            // Create student profile
            await this.createOrUpdateProfile(userId, grade, track);

            // Initialize topic progress
            const topicPromises = curriculumData.topics.map(topic => {
                return pool.query(`
                    INSERT INTO topic_progress (user_id, grade_id, topic_id, status, progress_percent)
                    VALUES ($1, $2, $3, 'not_started', 0)
                    ON CONFLICT (user_id, grade_id, topic_id) DO NOTHING
                `, [userId, gradeId, topic.id]);
            });

            await Promise.all(topicPromises);

            // Initialize subtopic progress
            const subtopicPromises = [];
            curriculumData.topics.forEach(topic => {
                if (topic.subtopics && topic.subtopics.length > 0) {
                    topic.subtopics.forEach(subtopic => {
                        subtopicPromises.push(
                            pool.query(`
                                INSERT INTO subtopic_progress 
                                (user_id, grade_id, topic_id, subtopic_id, status, mastery_level)
                                VALUES ($1, $2, $3, $4, 'not_started', 0)
                                ON CONFLICT (user_id, grade_id, topic_id, subtopic_id) DO NOTHING
                            `, [userId, gradeId, topic.id, subtopic.id])
                        );
                    });
                }
            });

            await Promise.all(subtopicPromises);

            console.log(`✅ Progress initialized: ${curriculumData.topics.length} topics, ${subtopicPromises.length} subtopics`);

            return {
                success: true,
                message: 'Progress initialized successfully',
                topicsCount: curriculumData.topics.length,
                subtopicsCount: subtopicPromises.length
            };
        } catch (error) {
            console.error('❌ Initialize progress error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create or update student profile
     */
    async createOrUpdateProfile(userId, grade, track, additionalData = {}) {
        try {
            const query = `
                INSERT INTO student_profiles 
                (user_id, grade, track, math_attitude, confidence_level, goals, weak_topics, learning_style)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (user_id) DO UPDATE SET
                    grade = EXCLUDED.grade,
                    track = EXCLUDED.track,
                    math_attitude = COALESCE(EXCLUDED.math_attitude, student_profiles.math_attitude),
                    confidence_level = COALESCE(EXCLUDED.confidence_level, student_profiles.confidence_level),
                    goals = COALESCE(EXCLUDED.goals, student_profiles.goals),
                    weak_topics = COALESCE(EXCLUDED.weak_topics, student_profiles.weak_topics),
                    learning_style = COALESCE(EXCLUDED.learning_style, student_profiles.learning_style),
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `;

            const result = await pool.query(query, [
                userId,
                grade,
                track,
                additionalData.mathAttitude || null,
                additionalData.confidenceLevel || null,
                additionalData.goals || null,
                additionalData.weakTopics || null,
                additionalData.learningStyle || null
            ]);

            return { success: true, profile: result.rows[0] };
        } catch (error) {
            console.error('❌ Create/update profile error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get student stats
     */
    async getStudentStats(userId, gradeId = null) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_topics,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_topics,
                    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_topics,
                    ROUND(AVG(progress_percent)) as avg_progress,
                    SUM(exercises_completed) as total_exercises,
                    SUM(exercises_correct) as total_correct,
                    SUM(total_time_minutes) as total_time_minutes
                FROM topic_progress
                WHERE user_id = $1 ${gradeId ? 'AND grade_id = $2' : ''}
            `;

            const values = gradeId ? [userId, gradeId] : [userId];
            const result = await pool.query(query, values);
            const stats = result.rows[0];

            return {
                success: true,
                stats: {
                    totalTopics: parseInt(stats.total_topics) || 0,
                    completedTopics: parseInt(stats.completed_topics) || 0,
                    inProgressTopics: parseInt(stats.in_progress_topics) || 0,
                    averageProgress: parseInt(stats.avg_progress) || 0,
                    totalExercises: parseInt(stats.total_exercises) || 0,
                    totalCorrect: parseInt(stats.total_correct) || 0,
                    totalTimeMinutes: parseInt(stats.total_time_minutes) || 0,
                    successRate: stats.total_exercises > 0
                        ? Math.round((stats.total_correct / stats.total_exercises) * 100)
                        : 0
                }
            };
        } catch (error) {
            console.error('❌ Get student stats error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update subtopic progress
     */
    async updateSubtopicProgress(userId, gradeId, topicId, subtopicId, progressData) {
        try {
            const {
                status,
                masteryLevel,
                isCorrect,
                hintsUsed,
                timeSeconds
            } = progressData;

            // Check if record exists
            const checkQuery = `
                SELECT * FROM subtopic_progress 
                WHERE user_id = $1 AND grade_id = $2 AND topic_id = $3 AND subtopic_id = $4
            `;
            const checkResult = await pool.query(checkQuery, [userId, gradeId, topicId, subtopicId]);

            if (checkResult.rows.length === 0) {
                // Insert new record
                const insertQuery = `
                    INSERT INTO subtopic_progress 
                    (user_id, grade_id, topic_id, subtopic_id, status, mastery_level, 
                     exercises_attempted, exercises_correct, hints_used, average_time_seconds)
                    VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $9)
                    RETURNING *
                `;
                const insertResult = await pool.query(insertQuery, [
                    userId, gradeId, topicId, subtopicId,
                    status || 'in_progress',
                    masteryLevel || 0,
                    isCorrect ? 1 : 0,
                    hintsUsed || 0,
                    timeSeconds || 0
                ]);
                return { success: true, progress: insertResult.rows[0] };
            }

            // Update existing record
            const updateQuery = `
                UPDATE subtopic_progress SET
                    status = COALESCE($1, status),
                    mastery_level = COALESCE($2, mastery_level),
                    exercises_attempted = exercises_attempted + 1,
                    exercises_correct = exercises_correct + CASE WHEN $3 THEN 1 ELSE 0 END,
                    hints_used = hints_used + COALESCE($4, 0),
                    last_practice = CURRENT_TIMESTAMP
                WHERE user_id = $5 AND grade_id = $6 AND topic_id = $7 AND subtopic_id = $8
                RETURNING *
            `;

            const result = await pool.query(updateQuery, [
                status,
                masteryLevel,
                isCorrect || false,
                hintsUsed || 0,
                userId,
                gradeId,
                topicId,
                subtopicId
            ]);

            return { success: true, progress: result.rows[0] };
        } catch (error) {
            console.error('❌ Update subtopic progress error:', error);
            return { success: false, error: error.message };
        }
    }
}

export default new CurriculumSyncService();