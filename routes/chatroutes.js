// routes/chat.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protectRoute } = require('../middleware/authMiddleware');
const chatController = require('../controllers/chatController');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/chat');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    cb(null, `chat-${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Apply authentication middleware to all routes
router.use(protectRoute);

// ========================================
// ROUTES
// ========================================

// GET - List all chats
router.get('/list', chatController.getChatList);

// GET - Get messages for a room
router.get('/messages/:roomId', chatController.getMessages);

// POST - Send message
router.post('/send', chatController.sendMessage);

// PUT - Mark message as seen
router.put('/messages/:messageId/seen', chatController.markMessageSeen);

// POST - Upload file
router.post('/upload', upload.single('file'), chatController.uploadFile);

// POST - Save call log
router.post('/call-log', chatController.saveCallLog);

// GET - Get unread count
router.get('/unread-count', chatController.getUnreadCount);

// DELETE - Clear chat
router.delete('/clear/:roomId', chatController.clearChat);

module.exports = router;