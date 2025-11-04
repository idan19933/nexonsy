import pg from 'pg';

const { Client } = pg;

const schema = `
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_profiles (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100),
    grade VARCHAR(20),
    track VARCHAR(50),
    personality VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topic_progress (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grade_id VARCHAR(100),
    topic_id VARCHAR(100) NOT NULL,
    exercises_completed INTEGER DEFAULT 0,
    exercises_correct INTEGER DEFAULT 0,
    total_time_minutes INTEGER DEFAULT 0,
    progress_percent INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'not_started',
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, grade_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_progress_user ON topic_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_progress_topic ON topic_progress(topic_id);

CREATE TABLE IF NOT EXISTS subtopic_progress (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id VARCHAR(100) NOT NULL,
    subtopic_id VARCHAR(100) NOT NULL,
    exercises_completed INTEGER DEFAULT 0,
    exercises_correct INTEGER DEFAULT 0,
    mastery_level INTEGER DEFAULT 0,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, topic_id, subtopic_id)
);

CREATE INDEX IF NOT EXISTS idx_subtopic_progress_user ON subtopic_progress(user_id);

CREATE TABLE IF NOT EXISTS student_progress (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(200),
    subtopic VARCHAR(200),
    questions_answered INTEGER DEFAULT 0,
    questions_correct INTEGER DEFAULT 0,
    last_practice TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notebook_entries (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) DEFAULT 'exercise',
    topic VARCHAR(200),
    subtopic VARCHAR(200),
    title TEXT,
    summary TEXT,
    content JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notebook_student ON notebook_entries(student_id);
CREATE INDEX IF NOT EXISTS idx_notebook_topic ON notebook_entries(topic);
CREATE INDEX IF NOT EXISTS idx_notebook_created ON notebook_entries(created_at DESC);

CREATE OR REPLACE VIEW student_progress_summary AS
SELECT 
    user_id,
    COUNT(DISTINCT topic_id) as total_topics,
    COUNT(DISTINCT CASE WHEN status = 'completed' THEN topic_id END) as completed_topics,
    SUM(exercises_completed) as total_exercises,
    SUM(exercises_correct) as total_correct,
    CASE 
        WHEN SUM(exercises_completed) > 0 
        THEN ROUND((SUM(exercises_correct)::DECIMAL / SUM(exercises_completed)) * 100, 1)
        ELSE 0 
    END as success_rate
FROM topic_progress
GROUP BY user_id;

CREATE OR REPLACE VIEW recent_student_activity AS
SELECT 
    user_id,
    topic_id,
    grade_id,
    last_activity,
    status,
    progress_percent
FROM topic_progress
ORDER BY last_activity DESC
LIMIT 10;
`;

async function setupDatabase() {
    const client = new Client({
        connectionString: 'postgresql://postgres:EapjOOOVYomHaqrEUizWtqpcXJeojOWB@nozomi.proxy.rlwy.net:34778/railway',
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🔄 Connecting to database...');
        await client.connect();
        console.log('✅ Connected to database');

        console.log('🔄 Creating tables...');
        await client.query(schema);
        console.log('✅ Schema created successfully!');

        // Verify tables
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);

        console.log('\n📋 Created tables:');
        result.rows.forEach(row => {
            console.log('  ✓', row.table_name);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\n🎉 Database setup complete!');
    }
}

setupDatabase();