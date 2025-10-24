// server/migrations/run-migration.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'nexon',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '12345678',
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
    console.log('🚀 Starting database migration...\n');

    try {
        // Read the SQL file
        const sqlFile = join(__dirname, '001_create_curriculum_tables.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');

        console.log('📄 SQL file loaded');
        console.log('📊 Creating tables...\n');

        // Execute the SQL
        await pool.query(sql);

        console.log('✅ Migration completed successfully!\n');

        // Verify tables were created
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (
                'student_profiles',
                'topic_progress',
                'subtopic_progress',
                'learning_sessions',
                'timeline_events',
                'student_goals'
            )
            ORDER BY table_name;
        `);

        console.log('📊 Tables created:');
        result.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });

        console.log(`\n🎉 Total: ${result.rows.length} tables created!\n`);

        if (result.rows.length === 6) {
            console.log('✅ All tables created successfully!');
            console.log('\n📌 Next step: Copy backend service files');
        } else {
            console.log('⚠️  Warning: Expected 6 tables, found ' + result.rows.length);
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('\nFull error:', error);
    } finally {
        await pool.end();
    }
}

runMigration();