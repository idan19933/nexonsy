// fix-columns.js
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

try {
    console.log('🔧 Adding missing columns...');
    
    await pool.query(`
        ALTER TABLE notebook_entries 
        ADD COLUMN IF NOT EXISTS student_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS type VARCHAR(100);
    `);
    
    console.log('📊 Creating indexes...');
    
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_notebook_student_id ON notebook_entries(student_id);
        CREATE INDEX IF NOT EXISTS idx_notebook_type ON notebook_entries(type);
    `);
    
    console.log('🔄 Updating existing rows...');
    
    await pool.query(`
        UPDATE notebook_entries 
        SET student_id = firebase_uid 
        WHERE student_id IS NULL;
    `);
    
    console.log('✅ All done! Columns added successfully!');
} catch (err) {
    console.error('❌ Error:', err.message);
}

await pool.end();
process.exit(0);
