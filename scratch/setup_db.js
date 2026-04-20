const { query } = require('../db');

async function setupDatabase() {
  try {
    console.log('--- Creating refresh_tokens table ---');
    await query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        refresh_token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ TABLE: refresh_tokens is ready.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating table:', err);
    process.exit(1);
  }
}

setupDatabase();
