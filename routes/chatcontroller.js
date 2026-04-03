// controllers/chatController.js
const { query } = require('../db');
const { v4: uuidv4 } = require('uuid');

// ========================================
// UTILITY FUNCTIONS
// ========================================

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>\"'()]/g, '');
}

// ========================================
// GET /api/chat/list - Get all chat rooms for user
// ========================================

exports.getChatList = async (req, res) => {
  try {
    const userId = req.user.id;

    const chats = await query(`
      SELECT 
        cr.id as roomId,
        cr.booking_id as bookingId,
        cr.mentor_id as mentorId,
        cr.created_at as createdAt,
        m.full_name as mentorName,
        m.profile_image_url as mentorAvatar,
        (SELECT message FROM mentor_messages 
         WHERE room_id = cr.id 
         ORDER BY created_at DESC LIMIT 1) as lastMessage,
        (SELECT created_at FROM mentor_messages 
         WHERE room_id = cr.id 
         ORDER BY created_at DESC LIMIT 1) as lastMessageTime,
        (SELECT COUNT(*) FROM mentor_messages 
         WHERE room_id = cr.id AND receiver_id = ? AND is_seen = 0) as unreadCount
      FROM mentor_chat_rooms cr
      JOIN mentors m ON cr.mentor_id = m.id
      WHERE cr.user_id = ?
      ORDER BY lastMessageTime DESC
    `, [userId, userId]);

    const formattedChats = chats.map(chat => ({
      roomId: chat.roomId,
      bookingId: chat.bookingId,
      mentorId: chat.mentorId,
      mentorName: chat.mentorName,
      mentorAvatar: chat.mentorAvatar,
      lastMessage: chat.lastMessage || 'No messages',
      lastMessageTime: chat.lastMessageTime || chat.createdAt,
      unreadCount: chat.unreadCount || 0,
      isOnline: true // Get from online status if available
    }));

    return res.status(200).json({
      success: true,
      chats: formattedChats
    });

  } catch (error) {
    console.error('❌ Error getting chat list:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get chat list',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========================================
// GET /api/chat/messages/:roomId - Get messages for a room
// ========================================

exports.getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Verify user has access to this room
    const [room] = await query(`
      SELECT * FROM mentor_chat_rooms 
      WHERE id = ? AND user_id = ?
    `, [roomId, userId]);

    if (!room) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const messages = await query(`
      SELECT * FROM mentor_messages 
      WHERE room_id = ?
      ORDER BY created_at ASC
      LIMIT 100
    `, [roomId]);

    return res.status(200).json({
      success: true,
      messages: messages.map(msg => ({
        id: msg.id,
        message: msg.encrypted_message,
        senderId: msg.sender_id,
        senderType: msg.sender_type,
        messageType: msg.message_type,
        fileUrl: msg.file_url,
        isSeen: msg.is_seen,
        createdAt: msg.created_at
      }))
    });

  } catch (error) {
    console.error('❌ Error getting messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get messages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========================================
// POST /api/chat/send - Save message to database
// ========================================

exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      roomId,
      message,
      messageType = 'text',
      fileUrl = null
    } = req.body;

    // Verify user has access to this room
    const [room] = await query(`
      SELECT * FROM mentor_chat_rooms 
      WHERE id = ? AND user_id = ?
    `, [roomId, userId]);

    if (!room) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Save message to database
    const messageId = uuidv4();
    await query(`
      INSERT INTO mentor_messages 
      (id, room_id, sender_id, receiver_id, sender_type, message_type, encrypted_message, file_url, is_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      messageId,
      roomId,
      userId,
      room.mentor_id,
      'user',
      messageType,
      message,
      fileUrl,
      0
    ]);

    return res.status(201).json({
      success: true,
      message: 'Message saved',
      messageId
    });

  } catch (error) {
    console.error('❌ Error sending message:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========================================
// PUT /api/chat/messages/:messageId/seen - Mark message as seen
// ========================================

exports.markMessageSeen = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Verify user has access to this message
    const [message] = await query(`
      SELECT * FROM mentor_messages 
      WHERE id = ? AND (receiver_id = ? OR sender_id = ?)
    `, [messageId, userId, userId]);

    if (!message) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await query(`
      UPDATE mentor_messages 
      SET is_seen = 1 
      WHERE id = ?
    `, [messageId]);

    return res.status(200).json({
      success: true,
      message: 'Message marked as seen'
    });

  } catch (error) {
    console.error('❌ Error marking message seen:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========================================
// POST /api/chat/call-log - Save call log
// ========================================

exports.saveCallLog = async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId, callType, duration, status } = req.body;

    // Verify room access
    const [room] = await query(`
      SELECT * FROM mentor_chat_rooms 
      WHERE id = ? AND user_id = ?
    `, [roomId, userId]);

    if (!room) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await query(`
      INSERT INTO call_logs 
      (id, room_id, caller_id, receiver_id, call_type, start_time, end_time, duration, call_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      roomId,
      userId,
      room.mentor_id,
      callType,
      new Date(),
      new Date(),
      duration,
      status
    ]);

    return res.status(201).json({
      success: true,
      message: 'Call logged'
    });

  } catch (error) {
    console.error('❌ Error saving call log:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save call log',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========================================
// POST /api/chat/upload - Upload file
// ========================================

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileUrl = `/uploads/chat/${req.file.filename}`;

    return res.status(201).json({
      success: true,
      message: 'File uploaded',
      fileUrl
    });

  } catch (error) {
    console.error('❌ Error uploading file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========================================
// GET /api/chat/unread-count - Get unread message count
// ========================================

exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const [result] = await query(`
      SELECT COUNT(*) as count FROM mentor_messages 
      WHERE receiver_id = ? AND is_seen = 0
    `, [userId]);

    return res.status(200).json({
      success: true,
      count: result.count || 0
    });

  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========================================
// DELETE /api/chat/clear/:roomId - Clear chat history
// ========================================

exports.clearChat = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Verify access
    const [room] = await query(`
      SELECT * FROM mentor_chat_rooms 
      WHERE id = ? AND user_id = ?
    `, [roomId, userId]);

    if (!room) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await query(`
      DELETE FROM mentor_messages 
      WHERE room_id = ?
    `, [roomId]);

    return res.status(200).json({
      success: true,
      message: 'Chat cleared'
    });

  } catch (error) {
    console.error('❌ Error clearing chat:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear chat',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;