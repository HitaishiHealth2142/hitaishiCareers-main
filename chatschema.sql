-- SQL Schema for MyChat
-- =====================================

-- =====================================
-- MENTOR_CHAT_ROOMS TABLE
-- =====================================
-- Stores chat rooms between users and mentors
CREATE TABLE IF NOT EXISTS mentor_chat_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL UNIQUE,
  user_id INT NOT NULL,
  mentor_id CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  FOREIGN KEY (booking_id) REFERENCES mentor_bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
  
  -- Indexes
  INDEX idx_booking_id (booking_id),
  INDEX idx_user_id (user_id),
  INDEX idx_mentor_id (mentor_id),
  INDEX idx_created_at (created_at)
);

-- =====================================
-- MENTOR_MESSAGES TABLE
-- =====================================
-- Stores all messages between user and mentor
CREATE TABLE IF NOT EXISTS mentor_messages (
  id CHAR(36) PRIMARY KEY,
  room_id INT NOT NULL,
  sender_id INT NOT NULL,
  receiver_id INT DEFAULT NULL,
  sender_type ENUM('user', 'mentor') DEFAULT 'user',
  message_type ENUM('text', 'image', 'file', 'voice') DEFAULT 'text',
  encrypted_message LONGTEXT,
  file_url VARCHAR(500) DEFAULT NULL,
  is_seen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  FOREIGN KEY (room_id) REFERENCES mentor_chat_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Indexes
  INDEX idx_room_id (room_id),
  INDEX idx_sender_id (sender_id),
  INDEX idx_is_seen (is_seen),
  INDEX idx_created_at (created_at),
  INDEX idx_room_created (room_id, created_at)
);

-- =====================================
-- CALL_LOGS TABLE
-- =====================================
-- Stores call history and details
CREATE TABLE IF NOT EXISTS call_logs (
  id CHAR(36) PRIMARY KEY,
  room_id INT NOT NULL,
  caller_id INT NOT NULL,
  receiver_id INT NOT NULL,
  call_type ENUM('audio', 'video') DEFAULT 'audio',
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP DEFAULT NULL,
  duration INT DEFAULT 0,
  call_status ENUM('initiated', 'ringing', 'accepted', 'rejected', 'completed', 'missed') DEFAULT 'initiated',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  FOREIGN KEY (room_id) REFERENCES mentor_chat_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES mentors(id) ON DELETE CASCADE,
  
  -- Indexes
  INDEX idx_room_id (room_id),
  INDEX idx_caller_id (caller_id),
  INDEX idx_receiver_id (receiver_id),
  INDEX idx_call_status (call_status),
  INDEX idx_created_at (created_at)
);

-- =====================================
-- MESSAGE_REACTIONS TABLE (OPTIONAL)
-- =====================================
-- For future emoji reactions feature
CREATE TABLE IF NOT EXISTS message_reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id CHAR(36) NOT NULL,
  user_id INT NOT NULL,
  emoji VARCHAR(10) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (message_id) REFERENCES mentor_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  UNIQUE KEY unique_reaction (message_id, user_id),
  INDEX idx_message_id (message_id),
  INDEX idx_user_id (user_id)
);

-- =====================================
-- BLOCKED_USERS TABLE (OPTIONAL)
-- =====================================
-- For block functionality
CREATE TABLE IF NOT EXISTS blocked_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  blocked_mentor_id CHAR(36) NOT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
  
  UNIQUE KEY unique_block (user_id, blocked_mentor_id),
  INDEX idx_user_id (user_id)
);

-- =====================================
-- INITIALIZATION SCRIPT
-- =====================================
-- Add this to your server startup to ensure tables exist

-- Drop tables if needed (for development)
-- DROP TABLE IF EXISTS message_reactions;
-- DROP TABLE IF EXISTS blocked_users;
-- DROP TABLE IF EXISTS call_logs;
-- DROP TABLE IF EXISTS mentor_messages;
-- DROP TABLE IF EXISTS mentor_chat_rooms;

-- =====================================
-- SAMPLE QUERIES
-- =====================================

-- Get all chat rooms for a user
-- SELECT 
--   cr.id, cr.booking_id, m.full_name, m.profile_image_url,
--   (SELECT message FROM mentor_messages WHERE room_id = cr.id ORDER BY created_at DESC LIMIT 1) as last_message,
--   (SELECT COUNT(*) FROM mentor_messages WHERE room_id = cr.id AND receiver_id = ? AND is_seen = 0) as unread_count
-- FROM mentor_chat_rooms cr
-- JOIN mentors m ON cr.mentor_id = m.id
-- WHERE cr.user_id = ?
-- ORDER BY cr.updated_at DESC;

-- Get unread messages
-- SELECT COUNT(*) as unread_count 
-- FROM mentor_messages 
-- WHERE receiver_id = ? AND is_seen = 0;

-- Get call history
-- SELECT * FROM call_logs 
-- WHERE (caller_id = ? OR receiver_id = ?) 
-- ORDER BY created_at DESC 
-- LIMIT 20;