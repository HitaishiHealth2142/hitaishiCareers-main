const { query } = require('../db');

async function migrate() {
    try {
        console.log('Adding email column to refresh_tokens table...');
        
        // Check if column exists first
        const columns = await query('SHOW COLUMNS FROM refresh_tokens LIKE "email"');
        if (columns.length === 0) {
            await query('ALTER TABLE refresh_tokens ADD COLUMN email VARCHAR(255) NOT NULL AFTER role');
            console.log('✅ email column added successfully.');
        } else {
            console.log('ℹ️ email column already exists.');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
