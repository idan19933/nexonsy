// server/start-with-migrations.js
// This file runs migrations before starting the server

import runMigrations from './migrations/run-migrations.js';

console.log('🚀 Nexon AI - Starting with Database Migrations');
console.log('');

async function start() {
    try {
        // Step 1: Run migrations
        await runMigrations();

        // Step 2: Import and start the main server
        console.log('');
        console.log('🚀 Starting main server...');
        await import('./ai-proxy.js');

    } catch (error) {
        console.error('❌ Startup failed:', error);
        process.exit(1);
    }
}

start();