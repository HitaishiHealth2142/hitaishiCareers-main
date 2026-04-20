const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { query } = require("../db");
const { protect } = require("../middleware/auth");

module.exports = function (app, io) {
  const router = express.Router();

  // ========================================
  // AUTO CREATE TABLES
  // ========================================
  async function initializeChatTables() {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS mentor_chat_rooms (
          id INT AUTO_INCREMENT PRIMARY KEY,
          uuid VARCHAR(36) NOT NULL UNIQUE,
          booking_id INT NOT NULL UNIQUE,
          user_id INT NOT NULL,
          mentor_id CHAR(36) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS mentor_messages (
          id CHAR(36) PRIMARY KEY,
          uuid VARCHAR(36) NOT NULL UNIQUE,
          room_id INT NOT NULL,
          sender_id VARCHAR(50) NOT NULL,
          receiver_id VARCHAR(50) DEFAULT NULL,
          sender_type ENUM('user','mentor') DEFAULT 'user',
          message_type ENUM('text','image','file','voice') DEFAULT 'text',
          encrypted_message LONGTEXT,
          file_url VARCHAR(500),
          is_seen BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS call_logs (
          id CHAR(36) PRIMARY KEY,
          uuid VARCHAR(36) NOT NULL UNIQUE,
          room_id INT NOT NULL,
          caller_id VARCHAR(50) NOT NULL,
          receiver_id VARCHAR(50) NOT NULL,
          call_type ENUM('audio','video') DEFAULT 'audio',
          duration INT DEFAULT 0,
          call_status ENUM('completed','missed','rejected') DEFAULT 'completed',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log("✅ Chat tables initialized");
    } catch (error) {
      console.error("❌ Table init failed:", error);
    }
  }

  initializeChatTables();

  // ========================================
  // FILE UPLOAD SETUP
  // ========================================
  const uploadDir = path.join(__dirname, "../uploads/chat");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const unique = Date.now() + "-" + Math.random().toString(36).slice(2, 9);
      cb(null, `chat-${unique}${path.extname(file.originalname)}`);
    }
  });

  const upload = multer({ storage });

  function sanitize(str) {
    if (typeof str !== "string") return "";
    return str.replace(/[<>\"'()]/g, "");
  }

  // ========================================
  // ROUTE FUNCTIONS
  // ========================================
  async function getChatList(req, res) {
    try {
      const userId = req.user.id;
      const chats = await query(`
        SELECT cr.id as roomId,
               cr.booking_id as bookingId,
               cr.mentor_id as mentorId,
               cr.created_at as createdAt,
               m.full_name as mentorName,
               m.profile_image_url as mentorAvatar,
               COALESCE(last_messages.lastMessage, '') AS lastMessage,
               COALESCE(last_messages.lastMessageTime, cr.created_at) AS lastMessageTime,
               COALESCE(unread_counts.unreadCount, 0) AS unreadCount
        FROM mentor_chat_rooms cr
        JOIN mentors m ON cr.mentor_id = m.id
        LEFT JOIN (
          SELECT m.room_id, m.encrypted_message AS lastMessage, m.created_at AS lastMessageTime
          FROM mentor_messages m
          JOIN (
            SELECT room_id, MAX(created_at) AS max_created_at
            FROM mentor_messages
            GROUP BY room_id
          ) latest ON latest.room_id = m.room_id AND latest.max_created_at = m.created_at
        ) last_messages ON last_messages.room_id = cr.id
        LEFT JOIN (
          SELECT room_id, COUNT(*) AS unreadCount
          FROM mentor_messages
          WHERE is_seen = 0 AND receiver_id = ?
          GROUP BY room_id
        ) unread_counts ON unread_counts.room_id = cr.id
        WHERE cr.user_id = ? OR cr.mentor_id = ?
        ORDER BY lastMessageTime DESC, cr.created_at DESC
      `, [userId, userId, userId]);

      res.json({ success: true, chats });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async function getMessages(req, res) {
    try {
      const { roomId } = req.params;
      const messages = await query(`
        SELECT * FROM mentor_messages
        WHERE room_id = ?
        ORDER BY created_at ASC
      `, [roomId]);

      res.json({ success: true, messages });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async function sendMessage(req, res) {
    try {
      const userId = req.user.id;
      const { roomId, message, messageType = "text", fileUrl = null } = req.body;

      const [room] = await query(
        'SELECT * FROM mentor_chat_rooms WHERE id = ? AND (user_id = ? OR mentor_id = ?)',
        [roomId, userId, userId]
      );
      if (!room) {
        return res.status(403).json({ success: false, message: 'Invalid chat room' });
      }

      const [booking] = await query(
        'SELECT * FROM mentor_bookings WHERE id = ?',
        [room.booking_id]
      );
      if (!booking || booking.payment_status !== 'paid' || !booking.session_end || new Date(booking.session_end) < new Date()) {
        return res.status(403).json({ success: false, message: 'Session inactive or expired' });
      }

      const receiverId = (req.user.role === 'user') ? room.mentor_id : room.user_id;
      const messageId = uuidv4();
      await query(`
        INSERT INTO mentor_messages
        (id, uuid, room_id, sender_id, receiver_id, sender_type, message_type, encrypted_message, file_url, is_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        messageId,
        uuidv4(),
        roomId,
        userId,
        receiverId,
        (req.user.role === 'mentor' ? 'mentor' : 'user'),
        messageType,
        sanitize(message),
        fileUrl,
        0
      ]);

      res.json({ success: true, messageId });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async function markMessageSeen(req, res) {
    try {
      await query(`UPDATE mentor_messages SET is_seen = 1 WHERE id = ?`, [req.params.messageId]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async function saveCallLog(req, res) {
    try {
      const userId = req.user.id;
      const { roomId, callType, duration, status } = req.body;

      await query(`
        INSERT INTO call_logs
        (id, room_id, caller_id, receiver_id, call_type, duration, call_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        uuidv4(),
        roomId,
        userId,
        req.body.receiverId || "mentor",
        callType,
        duration,
        status
      ]);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async function uploadFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }
      res.json({
        success: true,
        fileUrl: `/uploads/chat/${req.file.filename}`
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async function getUnreadCount(req, res) {
    try {
      const [result] = await query(`
        SELECT COUNT(*) as count
        FROM mentor_messages
        WHERE receiver_id = ? AND is_seen = 0
      `, [req.user.id]);

      res.json({ success: true, count: result.count || 0 });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async function clearChat(req, res) {
    try {
      await query(`DELETE FROM mentor_messages WHERE room_id = ?`, [req.params.roomId]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ========================================
  // ROUTES
  // ========================================
  router.use(protect(['user', 'mentor']));

  router.get("/list", getChatList);
  router.get("/messages/:roomId", getMessages);
  router.post("/send", sendMessage);
  router.put("/messages/:messageId/seen", markMessageSeen);
  router.post("/upload", upload.single("file"), uploadFile);
  router.post("/call-log", saveCallLog);
  router.get("/unread-count", getUnreadCount);
  router.delete("/clear/:roomId", clearChat);

  app.use("/api/chat", router);
};