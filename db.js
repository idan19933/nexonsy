// server/db.js - DATABASE CONNECTION
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;

export async function initDatabase() {
    if (db) return db;

    try {
        db = await open({
            filename: path.join(__dirname, '../database/nexon.db'),
            driver: sqlite3.Database
        });

        // Create tables if they don't exist
        await db.exec(`
            CREATE TABLE IF NOT EXISTS problems (
                                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                    question TEXT NOT NULL,
                                                    answer TEXT NOT NULL,
                                                    steps TEXT,
                                                    hints TEXT,
                                                    difficulty INTEGER,
                                                    topic TEXT,
                                                    category TEXT,
                                                    subcategory TEXT,
                                                    grade TEXT,
                                                    tier INTEGER,
                                                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_topic ON problems(topic);
            CREATE INDEX IF NOT EXISTS idx_difficulty ON problems(difficulty);
            CREATE INDEX IF NOT EXISTS idx_category ON problems(category);
        `);

        console.log('✅ Database tables initialized');

        // Check if database has data
        const count = await db.get('SELECT COUNT(*) as count FROM problems');
        console.log(`📊 Database has ${count.count} problems`);

        if (count.count === 0) {
            console.warn('⚠️ Database is empty! Run: cd database && node populate.js');
        }

        return db;

    } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    }
}

export function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

export async function closeDatabase() {
    if (db) {
        await db.close();
        db = null;
        console.log('✅ Database connection closed');
    }
}

export default { initDatabase, getDatabase, closeDatabase };