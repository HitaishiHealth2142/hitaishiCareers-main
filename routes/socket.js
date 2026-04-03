// socket.js - Socket.IO Chat & Call Handling

module.exports = function(io, app) {
  const { query } = require('./db');
  const { v4: uuidv4 } = require('uuid');

  // Store active users
  const activeUsers = new Map(); // userId -> socketId
  const activeCalls = new Map(); // roomId -> callData

  const chatNamespace = io.of('/');

  // ========================================
  // CONNECTION & AUTHENTICATION
  // ========================================

  chatNamespace.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);

    // ========================================
    // ROOM MANAGEMENT
    // ========================================

    socket.on('joinChatRoom', async (data) => {
      try {
        const { roomId, bookingId } = data;
        const userId = socket.handshake.auth?.userId;

        if (!userId || !roomId) {
          socket.emit('error', { message: 'Missing required data' });
          return;
        }

        // Verify booking
        const [booking] = await query(
          'SELECT * FROM mentor_bookings WHERE id = ? AND user_id = ?',
          [bookingId, userId]
        );

        if (!booking) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        // Store user mapping
        activeUsers.set(userId, socket.id);

        // Join socket room
        socket.join(roomId);
        socket.currentRoom = roomId;
        socket.userId = userId;
        socket.bookingId = bookingId;

        // Broadcast user online
        socket.to(roomId).emit('userOnline', { userId });
        console.log(`✅ User ${userId} joined room ${roomId}`);

      } catch (error) {
        console.error('❌ Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // ========================================
    // MESSAGING
    // ========================================

    socket.on('sendMessage', async (data) => {
      try {
        const {
          roomId,
          message,
          senderId,
          senderType,
          messageType,
          timestamp
        } = data;

        // Save to database
        const messageId = uuidv4();
        await query(`
          INSERT INTO mentor_messages 
          (id, room_id, sender_id, sender_type, message_type, encrypted_message, is_seen)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [messageId, roomId, senderId, senderType, messageType, message, 0]);

        // Broadcast to room
        socket.to(roomId).emit('receiveMessage', {
          id: messageId,
          roomId,
          message,
          senderId,
          senderType,
          messageType,
          isSeen: false,
          createdAt: timestamp
        });

      } catch (error) {
        console.error('❌ Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ========================================
    // TYPING INDICATOR
    // ========================================

    socket.on('typing', (data) => {
      const { roomId } = data;
      socket.to(roomId).emit('typing', { roomId, userId: socket.userId });
    });

    socket.on('stopTyping', (data) => {
      const { roomId } = data;
      socket.to(roomId).emit('stopTyping', { roomId });
    });

    // ========================================
    // MESSAGE STATUS
    // ========================================

    socket.on('messageSeen', async (data) => {
      try {
        const { roomId } = data;

        // Mark all messages in room as seen by this user
        await query(`
          UPDATE mentor_messages 
          SET is_seen = 1 
          WHERE room_id = ? AND receiver_id = ?
        `, [roomId, socket.userId]);

        // Broadcast
        socket.to(roomId).emit('messageSeen', { roomId, userId: socket.userId });

      } catch (error) {
        console.error('❌ Error marking seen:', error);
      }
    });

    // ========================================
    // WEBRTC - CALL INITIATION
    // ========================================

    socket.on('callUser', (data) => {
      try {
        const {
          to,
          roomId,
          callType,
          offer
        } = data;

        const targetSocketId = activeUsers.get(to);
        if (targetSocketId) {
          // Store call data
          activeCalls.set(roomId, {
            caller: socket.userId,
            receiver: to,
            callType,
            startTime: Date.now()
          });

          io.to(targetSocketId).emit('incomingCall', {
            from: socket.userId,
            roomId,
            callType,
            offer
          });

          console.log(`📞 Call initiated from ${socket.userId} to ${to}`);
        }
      } catch (error) {
        console.error('❌ Error initiating call:', error);
      }
    });

    // ========================================
    // WEBRTC - CALL RESPONSE
    // ========================================

    socket.on('acceptCall', (data) => {
      try {
        const {
          to,
          roomId,
          answer
        } = data;

        const targetSocketId = activeUsers.get(to);
        if (targetSocketId) {
          io.to(targetSocketId).emit('callAccepted', {
            from: socket.userId,
            roomId,
            answer
          });

          console.log(`✅ Call accepted by ${socket.userId}`);
        }
      } catch (error) {
        console.error('❌ Error accepting call:', error);
      }
    });

    socket.on('rejectCall', (data) => {
      try {
        const { to, roomId } = data;

        const targetSocketId = activeUsers.get(to);
        if (targetSocketId) {
          io.to(targetSocketId).emit('callRejected', {
            from: socket.userId,
            roomId
          });

          activeCalls.delete(roomId);
          console.log(`❌ Call rejected by ${socket.userId}`);
        }
      } catch (error) {
        console.error('❌ Error rejecting call:', error);
      }
    });

    // ========================================
    // WEBRTC - ICE CANDIDATES
    // ========================================

    socket.on('iceCandidate', (data) => {
      try {
        const { to, roomId, candidate } = data;

        const targetSocketId = activeUsers.get(to);
        if (targetSocketId) {
          io.to(targetSocketId).emit('iceCandidate', {
            from: socket.userId,
            roomId,
            candidate
          });
        }
      } catch (error) {
        console.error('❌ Error sending ICE candidate:', error);
      }
    });

    // ========================================
    // WEBRTC - OFFER & ANSWER
    // ========================================

    socket.on('offer', (data) => {
      try {
        const { to, roomId, offer } = data;

        const targetSocketId = activeUsers.get(to);
        if (targetSocketId) {
          io.to(targetSocketId).emit('offer', {
            from: socket.userId,
            roomId,
            offer
          });
        }
      } catch (error) {
        console.error('❌ Error sending offer:', error);
      }
    });

    socket.on('answer', (data) => {
      try {
        const { to, roomId, answer } = data;

        const targetSocketId = activeUsers.get(to);
        if (targetSocketId) {
          io.to(targetSocketId).emit('answer', {
            from: socket.userId,
            roomId,
            answer
          });
        }
      } catch (error) {
        console.error('❌ Error sending answer:', error);
      }
    });

    // ========================================
    // CALL TERMINATION
    // ========================================

    socket.on('callEnded', async (data) => {
      try {
        const { to, roomId, duration } = data;

        const targetSocketId = activeUsers.get(to);
        if (targetSocketId) {
          io.to(targetSocketId).emit('callEnded', {
            from: socket.userId,
            roomId
          });
        }

        // Save call log
        const [booking] = await query(
          'SELECT mentor_id FROM mentor_bookings WHERE id = ?',
          [socket.bookingId]
        );

        if (booking) {
          await query(`
            INSERT INTO call_logs 
            (id, room_id, caller_id, receiver_id, call_type, duration, call_status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            uuidv4(),
            roomId,
            socket.userId,
            booking.mentor_id,
            activeCalls.get(roomId)?.callType || 'audio',
            duration,
            'completed'
          ]);
        }

        activeCalls.delete(roomId);
        console.log(`📞 Call ended. Duration: ${duration}s`);

      } catch (error) {
        console.error('❌ Error ending call:', error);
      }
    });

    // ========================================
    // DISCONNECTION
    // ========================================

    socket.on('disconnect', async () => {
      try {
        // Remove user from active list
        activeUsers.delete(socket.userId);

        // Broadcast offline status
        if (socket.currentRoom) {
          socket.to(socket.currentRoom).emit('userOffline', {
            userId: socket.userId
          });
        }

        // End any active calls
        for (const [roomId, callData] of activeCalls.entries()) {
          if (callData.caller === socket.userId || callData.receiver === socket.userId) {
            const otherUser = callData.caller === socket.userId 
              ? callData.receiver 
              : callData.caller;

            const targetSocketId = activeUsers.get(otherUser);
            if (targetSocketId) {
              io.to(targetSocketId).emit('callEnded', { reason: 'User disconnected' });
            }

            activeCalls.delete(roomId);
          }
        }

        console.log('❌ User disconnected:', socket.userId);

      } catch (error) {
        console.error('❌ Error on disconnect:', error);
      }
    });

    // ========================================
    // ERROR HANDLING
    // ========================================

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });
  });

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================

  // Get online status of user
  global.isUserOnline = (userId) => {
    return activeUsers.has(userId);
  };

  // Get socket ID for user
  global.getUserSocketId = (userId) => {
    return activeUsers.get(userId);
  };

  // Broadcast to room
  global.broadcastToRoom = (roomId, event, data) => {
    io.to(roomId).emit(event, data);
  };
};