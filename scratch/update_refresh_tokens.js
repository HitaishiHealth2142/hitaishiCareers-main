const { query } = require('../db');

async function updateRefreshTokenTable() {
    try {
        console.log('--- Updating refresh_tokens table ---');
        
        // Drop existing if it doesn't match the new required structure
        // Or just create it with IF NOT EXISTS if we are sure
        // Given the mismatch, it's safer to ensure the columns exist
        
        await query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                token_hash VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_token_hash (token_hash),
                INDEX idx_user_role (user_id, role)
            )
        `);
        
        console.log('✅ TABLE: refresh_tokens is ready and updated.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error updating table:', err);
        process.exit(1);
    }
}

updateRefreshTokenTable();
