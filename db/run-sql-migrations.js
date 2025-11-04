// server/db/run-sql-migrations.js
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Migration tracking table
const createMigrationsTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

// Get executed migrations
const getExecutedMigrations = async () => {
    const result = await pool.query('SELECT filename FROM migrations ORDER BY filename');
    return result.rows.map(row => row.filename);
};

// Run SQL file
const runSQLFile = async (filename) => {
    const filePath = path.join(__dirname, '..', 'migrations', filename);
    const sql = fs.readFileSync(filePath, 'utf8');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        console.log(`🔄 Running migration: ${filename}`);

        // Execute the SQL file
        await client.query(sql);

        // Record the migration
        await client.query(
            'INSERT INTO migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
            [filename]
        );

        await client.query('COMMIT');
        console.log(`✅ Completed: ${filename}`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed: ${filename}`, error.message);
        throw error;
    } finally {
        client.release();
    }
};

// Main function
const runMigrations = async () => {
    try {
        console.log('🚀 Starting SQL migrations...');
        console.log('📦 Database:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'local');

        await createMigrationsTable();

        // Get executed migrations
        const executed = await getExecutedMigrations();
        console.log(`📋 Already executed: ${executed.length} migrations`);

        // Get all SQL files
        const migrationsDir = path.join(__dirname, '..', 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        // Find pending migrations
        const pending = files.filter(f => !executed.includes(f));

        if (pending.length === 0) {
            console.log('✨ No pending migrations');
            return;
        }

        console.log(`📝 Found ${pending.length} pending migrations:`);
        pending.forEach(f => console.log(`   - ${f}`));

        // Run each pending migration
        for (const file of pending) {
            await runSQLFile(file);
        }

        console.log('🎉 All migrations completed!');

    } catch (error) {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
};

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runMigrations();
}

export default runMigrations;