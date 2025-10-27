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
        // Get all migration files
        const migrationFiles = fs.readdirSync(__dirname)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Run in order: 001, 002, etc.

        console.log(`📄 Found ${migrationFiles.length} migration file(s)`);

        for (const file of migrationFiles) {
            const migrationPath = path.join(__dirname, file);
            console.log(`📄 Running: ${file}`);

            const sql = fs.readFileSync(migrationPath, 'utf8');

            try {
                await pool.query(sql);
                console.log(`   ✅ ${file} completed`);
            } catch (err) {
                // Skip if already applied (tables exist, columns exist, etc.)
                if (err.code === '42P07' || err.code === '42701') {
                    console.log(`   ⏭️  ${file} already applied`);
                } else {
                    throw err;
                }
            }
        }

        console.log('✅ All migrations completed!');

        // Verify tables created
        const tables = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        console.log('📊 Database tables:');
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