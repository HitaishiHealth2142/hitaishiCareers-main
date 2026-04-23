const { query } = require("../db");
const sessionId = crypto.randomBytes(16).toString('hex');

async function initAuthTables() {
  try {
    // Refresh Tokens Table (UPGRADED)
    await query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        role ENUM('user','admin','company','mentor') NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token_hash (token_hash),
        INDEX idx_user_role (user_id, role)
      )
    `);

    // 🔥 LOGIN LOGS TABLE (YOUR NEW REQUIREMENT)
    await query(`
      CREATE TABLE IF NOT EXISTS login_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50),
        role ENUM('user','admin','company','mentor'),
        session_id VARCHAR(100),
        login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        logout_time TIMESTAMP NULL,
        ip_address VARCHAR(100),
        user_agent TEXT
      )
    `);

    console.log("✅ Auth tables ready");
  } catch (err) {
    console.error("❌ Auth table init failed:", err);
  }
}

module.exports = initAuthTables;
