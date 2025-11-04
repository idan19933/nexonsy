// server/services/cronJobs.js - ES6 VERSION
import cron from 'node-cron';
import pool from '../config/database.js';

class CronJobsManager {
    constructor() {
        this.jobs = new Map();
        this.isInitialized = false;
    }

    /**
     * Initialize all cron jobs
     */
    initialize() {
        if (this.isInitialized) {
            console.log('⚠️ [Cron] Jobs already initialized');
            return;
        }

        console.log('🕐 [Cron] Initializing scheduled tasks...');

        // 1. Daily Statistics Update - Every day at 3 AM
        this.addJob('dailyStats', '0 3 * * *', async () => {
            console.log('📊 [Cron] Running daily statistics update...');
            try {
                await this.updateDailyStats();
                console.log('✅ [Cron] Daily stats completed');
            } catch (error) {
                console.error('❌ [Cron] Daily stats failed:', error);
            }
        });

        // 2. Clean Old Data - Weekly (Monday at 4 AM)
        this.addJob('dataCleanup', '0 4 * * 1', async () => {
            console.log('🧹 [Cron] Running data cleanup...');
            try {
                await this.cleanOldData();
                console.log('✅ [Cron] Data cleanup completed');
            } catch (error) {
                console.error('❌ [Cron] Data cleanup failed:', error);
            }
        });

        // 3. Update Question Quality Scores - Daily at 5 AM
        this.addJob('qualityUpdate', '0 5 * * *', async () => {
            console.log('⭐ [Cron] Updating question quality scores...');
            try {
                await this.updateQuestionQuality();
                console.log('✅ [Cron] Quality update completed');
            } catch (error) {
                console.error('❌ [Cron] Quality update failed:', error);
            }
        });

        // 4. Generate Performance Reports - Weekly (Sunday at 6 AM)
        this.addJob('performanceReports', '0 6 * * 0', async () => {
            console.log('📊 [Cron] Generating performance reports...');
            try {
                await this.generatePerformanceReports();
                console.log('✅ [Cron] Performance reports completed');
            } catch (error) {
                console.error('❌ [Cron] Performance reports failed:', error);
            }
        });

        this.isInitialized = true;
        console.log(`✅ [Cron] ${this.jobs.size} jobs initialized successfully`);
    }

    /**
     * Add a cron job
     */
    addJob(name, schedule, task) {
        if (this.jobs.has(name)) {
            console.warn(`⚠️ [Cron] Job ${name} already exists`);
            return;
        }

        const job = cron.schedule(schedule, task, {
            scheduled: true,
            timezone: "Asia/Jerusalem"
        });

        this.jobs.set(name, {
            job,
            schedule,
            task,
            lastRun: null,
            runCount: 0
        });

        console.log(`✅ [Cron] Job '${name}' scheduled: ${schedule}`);
    }

    /**
     * Update daily statistics
     */
    async updateDailyStats() {
        try {
            const query = `
                SELECT 
                    COUNT(DISTINCT user_id) as active_users,
                    COUNT(*) as total_questions,
                    AVG(CASE WHEN is_correct THEN 100.0 ELSE 0.0 END) as avg_accuracy
                FROM student_question_history
                WHERE created_at >= NOW() - INTERVAL '24 hours'
            `;

            const result = await pool.query(query);
            console.log('📊 Daily Stats:', result.rows[0]);
            return result.rows[0];
        } catch (error) {
            console.error('❌ [Stats Update] Failed:', error);
            return null;
        }
    }

    /**
     * Clean old data
     */
    async cleanOldData() {
        try {
            // Clean old recommendation cache (older than 7 days)
            const deleteCacheQuery = `
                DELETE FROM recommendation_cache
                WHERE generated_at < NOW() - INTERVAL '7 days'
            `;

            const cacheResult = await pool.query(deleteCacheQuery);
            console.log(`🗑️ [Cleanup] Deleted ${cacheResult.rowCount} old cache entries`);

            return {
                cacheDeleted: cacheResult.rowCount
            };
        } catch (error) {
            console.error('❌ [Cleanup] Failed:', error);
            return null;
        }
    }

    /**
     * Update question quality scores
     */
    async updateQuestionQuality() {
        try {
            const query = `
                UPDATE question_bank qb
                SET quality_score = LEAST(100, GREATEST(0,
                    50 + 
                    (CASE 
                        WHEN usage_count > 0 THEN 
                            (success_rate - 50) / 2
                        ELSE 0 
                    END) +
                    (CASE 
                        WHEN usage_count >= 10 THEN 10
                        WHEN usage_count >= 5 THEN 5
                        ELSE 0 
                    END)
                ))
                WHERE usage_count > 0 AND is_active = true
            `;

            const result = await pool.query(query);
            console.log(`✅ [Quality Update] Updated ${result.rowCount} questions`);
            return result.rowCount;
        } catch (error) {
            console.error('❌ [Quality Update] Failed:', error);
            return 0;
        }
    }

    /**
     * Generate weekly performance reports
     */
    async generatePerformanceReports() {
        try {
            const statsQuery = `
                SELECT 
                    COUNT(DISTINCT user_id) as active_users,
                    COUNT(*) as total_questions_answered,
                    AVG(CASE WHEN is_correct THEN 100.0 ELSE 0.0 END) as avg_accuracy,
                    AVG(time_spent_seconds) as avg_time
                FROM student_question_history
                WHERE created_at >= NOW() - INTERVAL '7 days'
            `;

            const statsResult = await pool.query(statsQuery);
            const stats = statsResult.rows[0];

            console.log('📊 [Performance Report] Weekly Statistics:', {
                activeUsers: stats.active_users,
                totalQuestions: stats.total_questions_answered,
                avgAccuracy: parseFloat(stats.avg_accuracy || 0).toFixed(2) + '%',
                avgTime: parseFloat(stats.avg_time || 0).toFixed(0) + 's'
            });

            return stats;
        } catch (error) {
            console.error('❌ [Performance Report] Failed:', error);
            return null;
        }
    }

    /**
     * Stop a specific job
     */
    stopJob(name) {
        const jobData = this.jobs.get(name);
        if (jobData) {
            jobData.job.stop();
            console.log(`⏸️ [Cron] Job '${name}' stopped`);
            return true;
        }
        return false;
    }

    /**
     * Start a specific job
     */
    startJob(name) {
        const jobData = this.jobs.get(name);
        if (jobData) {
            jobData.job.start();
            console.log(`▶️ [Cron] Job '${name}' started`);
            return true;
        }
        return false;
    }

    /**
     * Get job status
     */
    getJobStatus(name) {
        const jobData = this.jobs.get(name);
        if (!jobData) {
            return null;
        }

        return {
            name,
            schedule: jobData.schedule,
            lastRun: jobData.lastRun,
            runCount: jobData.runCount
        };
    }

    /**
     * Get all jobs status
     */
    getAllStatus() {
        const status = [];
        this.jobs.forEach((jobData, name) => {
            status.push(this.getJobStatus(name));
        });
        return status;
    }

    /**
     * Manually run a job
     */
    async runJobNow(name) {
        const jobData = this.jobs.get(name);
        if (!jobData) {
            throw new Error(`Job '${name}' not found`);
        }

        console.log(`🚀 [Cron] Manually running job '${name}'...`);

        try {
            await jobData.task();
            jobData.lastRun = new Date();
            jobData.runCount++;
            console.log(`✅ [Cron] Job '${name}' completed successfully`);
            return true;
        } catch (error) {
            console.error(`❌ [Cron] Job '${name}' failed:`, error);
            throw error;
        }
    }

    /**
     * Stop all jobs
     */
    stopAll() {
        this.jobs.forEach((jobData, name) => {
            jobData.job.stop();
        });
        console.log('⏸️ [Cron] All jobs stopped');
    }
}

// Export singleton instance
const cronManager = new CronJobsManager();

// ✅ ES6 NAMED EXPORTS
export function initialize() {
    return cronManager.initialize();
}

export function getAllStatus() {
    return cronManager.getAllStatus();
}

export function runJobNow(name) {
    return cronManager.runJobNow(name);
}

export function stopAll() {
    return cronManager.stopAll();
}

// Also export the instance
export default cronManager;