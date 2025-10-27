// server/migrations/run-migrations.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 Running Database Migrations');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        // Check if already migrated
        const checkTable = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            );
        `);

        if (checkTable.rows[0].exists) {
            console.log('✅ Database already migrated - tables exist');
            console.log('ℹ️  To re-run migrations, drop tables first');

            // Show table counts
            const counts = await pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as users,
                    (SELECT COUNT(*) FROM notebook_entries) as notebook,
                    (SELECT COUNT(*) FROM chat_sessions) as sessions,
                    (SELECT COUNT(*) FROM curriculum_progress) as progress
            `);

            console.log('📊 Current table counts:');
            console.log('   Users:', counts.rows[0].users);
            console.log('   Notebook:', counts.rows[0].notebook);
            console.log('   Sessions:', counts.rows[0].sessions);
            console.log('   Progress:', counts.rows[0].progress);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            return;
        }

        // Read migration file
        const migrationPath = path.join(__dirname, '001_initial_schema.sql');
        console.log('📄 Reading migration file:', migrationPath);

        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('✅ Migration file loaded');

        // Execute migration
        console.log('⚙️  Executing SQL...');
        await pool.query(sql);

        console.log('✅ Migration completed successfully!');

        // Verify tables created
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        console.log('📊 Created tables:');
        tables.rows.forEach(row => {
            console.log('   ✓', row.table_name);
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Database is ready!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Stack:', error.stack);
        throw error;
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runMigrations()
        .then(() => {
            console.log('✅ Done!');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Fatal error:', err);
            process.exit(1);
        });
}

export default runMigrations;