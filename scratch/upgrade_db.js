const { query } = require('../db');

async function upgradeDatabase() {
  try {
    console.log('--- Cleaning up old refresh_tokens table ---');
    await query('DROP TABLE IF EXISTS refresh_tokens');
    
    console.log('--- Creating upgraded refresh_tokens table ---');
    await query(`
      CREATE TABLE refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        role ENUM('user', 'admin', 'company', 'mentor') NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token_hash (token_hash),
        INDEX idx_user_role (user_id, role)
      )
    `);
    
    console.log('✅ TABLE: refresh_tokens is upgraded and ready.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error upgrading database:', err);
    process.exit(1);
  }
}

upgradeDatabase();
