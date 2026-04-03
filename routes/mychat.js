const express = require('express');
const router = express.Router();
// import the db
const { query } = require('../db');

// ================================
// AUTO CREATE CHAT TABLES
// ================================
async function initializeChatTables() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS mentor_chat_rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL UNIQUE,
        user_id INT NOT NULL,
        mentor_id CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_booking_id (booking_id),
        INDEX idx_user_id (user_id),
        INDEX idx_mentor_id (mentor_id)
      )
    `);

    await query(`
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
        INDEX idx_room_id (room_id),
        INDEX idx_sender_id (sender_id),
        INDEX idx_is_seen (is_seen)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS call_logs (
        id CHAR(36) PRIMARY KEY,
        room_id INT NOT NULL,
        caller_id INT NOT NULL,
        receiver_id INT NOT NULL,
        call_type ENUM('audio', 'video') DEFAULT 'audio',
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP NULL,
        duration INT DEFAULT 0,
        call_status ENUM('initiated', 'ringing', 'accepted', 'rejected', 'completed', 'missed') DEFAULT 'initiated',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_room_id (room_id)
      )
    `);

    console.log("✅ Chat tables initialized successfully");
  } catch (error) {
    console.error("❌ Error creating chat tables:", error);
  }
}

// run once when file loads
initializeChatTables();



class MyChatApp {
  constructor() {
    this.socket = null;
    this.currentChat = null;
    this.currentUser = null;
    this.currentMentor = null;
    this.bookingId = null;
    this.messages = [];
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.callInProgress = false;
    this.callType = null;
    this.callTimer = null;
    this.callStartTime = null;
    this.encryptionKey = null;
    this.chatRooms = [];
    this.isTyping = false;
    
    this.init();
  }

  async init() {
    try {
      // Load user data
      await this.loadUserData();
      
      // Setup UI
      this.setupUI();
      
      // Initialize Socket.IO
      this.initializeSocket();
      
      // Load chats
      await this.loadChats();
      
      // Setup event listeners
      this.setupEventListeners();
      
      console.log('✅ MyChat initialized successfully');
    } catch (error) {
      console.error('❌ Initialization error:', error);
      this.showToast('Failed to initialize chat', 'error');
    }
  }

  // ========================================
  // USER DATA & INITIALIZATION
  // ========================================

  async loadUserData() {
    try {
      // Get from session/localStorage
      const token = localStorage.getItem('token') || this.getCookie('token');
      const userStr = localStorage.getItem('user');
      
      if (!token || !userStr) {
        window.location.href = 'userProfile.html';
        return;
      }

      this.currentUser = JSON.parse(userStr);
      
      // Generate encryption key from user ID
      this.encryptionKey = this.currentUser.id;
      
      console.log('✅ User data loaded:', this.currentUser);
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      window.location.href = 'userProfile.html';
    }
  }

  getCookie(name) {
    const nameEQ = name + "=";
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(nameEQ)) {
        return decodeURIComponent(cookie.substring(nameEQ.length));
      }
    }
    return null;
  }

  setupUI() {
    // Get elements
    this.elements = {
      chatList: document.getElementById('chatList'),
      chatView: document.getElementById('chatView'),
      emptyState: document.getElementById('emptyState'),
      messagesContainer: document.getElementById('messagesContainer'),
      messageInput: document.getElementById('messageInput'),
      btnSendMessage: document.getElementById('btnSendMessage'),
      mentorName: document.getElementById('mentorName'),
      mentorAvatar: document.getElementById('mentorAvatar'),
      mentorStatus: document.getElementById('mentorStatus'),
      typingIndicator: document.getElementById('typingIndicator'),
      searchChats: document.getElementById('searchChats'),
      unreadCount: document.getElementById('unreadCount'),
      
      // Call elements
      btnAudioCall: document.getElementById('btnAudioCall'),
      btnVideoCall: document.getElementById('btnVideoCall'),
      incomingCallModal: document.getElementById('incomingCallModal'),
      btnAcceptCall: document.getElementById('btnAcceptCall'),
      btnRejectCall: document.getElementById('btnRejectCall'),
      callContainer: document.getElementById('callContainer'),
      remoteVideo: document.getElementById('remoteVideo'),
      localVideo: document.getElementById('localVideo'),
      btnMuteMic: document.getElementById('btnMuteMic'),
      btnMuteSpeaker: document.getElementById('btnMuteSpeaker'),
      btnToggleCamera: document.getElementById('btnToggleCamera'),
      btnEndCall: document.getElementById('btnEndCall'),
      callTimer: document.getElementById('activeCallTimer'),
      
      // Composer elements
      btnEmoji: document.getElementById('btnEmoji'),
      btnAttach: document.getElementById('btnAttach'),
      btnVoice: document.getElementById('btnVoice'),
      fileInput: document.getElementById('fileInput'),
      emojiPicker: document.getElementById('emojiPicker'),
      emojiGrid: document.getElementById('emojiGrid'),
      
      // Other
      btnBack: document.getElementById('btnBack'),
      toastContainer: document.getElementById('toastContainer'),
    };

    this.initializeEmojis();
  }

  initializeEmojis() {
    const emojis = ['😀', '😂', '❤️', '🔥', '👍', '🎉', '✨', '👏', '💯', '🙏', '😍', '😢', '😎', '🤔', '💪', '🚀'];
    
    this.elements.emojiGrid.innerHTML = '';
    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'emoji-item';
      btn.textContent = emoji;
      btn.onclick = (e) => {
        e.preventDefault();
        this.insertEmoji(emoji);
      };
      this.elements.emojiGrid.appendChild(btn);
    });
  }

  // ========================================
  // SOCKET.IO INITIALIZATION
  // ========================================

  initializeSocket() {
    this.socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling']
    });

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
      this.showToast('Connected', 'info');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      this.showToast('Disconnected. Reconnecting...', 'error');
    });

    // Chat events
    this.socket.on('receiveMessage', (data) => this.handleReceiveMessage(data));
    this.socket.on('typing', (data) => this.handleTyping(data));
    this.socket.on('stopTyping', () => this.handleStopTyping());
    this.socket.on('messageSeen', (data) => this.handleMessageSeen(data));
    this.socket.on('userOnline', (data) => this.handleUserOnline(data));
    this.socket.on('userOffline', (data) => this.handleUserOffline(data));
    this.socket.on('unreadCount', (data) => this.handleUnreadCount(data));

    // Call events
    this.socket.on('incomingCall', (data) => this.handleIncomingCall(data));
    this.socket.on('callAccepted', (data) => this.handleCallAccepted(data));
    this.socket.on('callRejected', (data) => this.handleCallRejected(data));
    this.socket.on('callEnded', () => this.handleCallEnded());
    this.socket.on('iceCandidate', (data) => this.handleIceCandidate(data));

    // WebRTC signaling events
    this.socket.on('offer', (data) => this.handleOffer(data));
    this.socket.on('answer', (data) => this.handleAnswer(data));
  }

  // ========================================
  // CHAT MANAGEMENT
  // ========================================

  async loadChats() {
    try {
      const token = localStorage.getItem('token') || this.getCookie('token');
      
      const response = await fetch('/api/chat/list', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to load chats');

      const data = await response.json();
      this.chatRooms = data.chats || [];
      
      this.renderChatList();
    } catch (error) {
      console.error('❌ Error loading chats:', error);
      this.elements.chatList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-circle"></i>
          <p>Failed to load chats</p>
          <small>${error.message}</small>
        </div>
      `;
    }
  }

  renderChatList() {
    if (this.chatRooms.length === 0) {
      this.elements.chatList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-comments"></i>
          <p>No chats yet</p>
          <small>Book a mentor to start chatting</small>
        </div>
      `;
      return;
    }

    this.elements.chatList.innerHTML = this.chatRooms
      .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime))
      .map(chat => `
        <div class="chat-item ${this.currentChat?.roomId === chat.roomId ? 'active' : ''}" 
             onclick="app.selectChat(${chat.roomId}, '${chat.mentorId}', '${chat.bookingId}')">
          <img src="${chat.mentorAvatar || 'https://via.placeholder.com/48'}" 
               alt="${chat.mentorName}" 
               class="chat-avatar ${chat.isOnline ? 'avatar-online' : ''}">
          <div class="chat-content">
            <div class="chat-header-text">
              <span class="chat-name">${this.escapeHtml(chat.mentorName)}</span>
              <span class="chat-time">${this.formatTime(chat.lastMessageTime)}</span>
            </div>
            <div class="chat-message ${chat.unreadCount > 0 ? 'unseen' : ''}">
              ${this.escapeHtml(chat.lastMessage || 'No messages')}
            </div>
          </div>
          ${chat.unreadCount > 0 ? `<div class="unread-badge">${chat.unreadCount}</div>` : ''}
        </div>
      `).join('');
  }

  async selectChat(roomId, mentorId, bookingId) {
    try {
      this.currentChat = {
        roomId,
        mentorId,
        bookingId
      };
      this.bookingId = bookingId;

      // Fetch mentor details
      const token = localStorage.getItem('token') || this.getCookie('token');
      const response = await fetch(`/api/mentors/${mentorId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load mentor details');

      this.currentMentor = await response.json();

      // Update UI
      this.elements.mentorName.textContent = this.currentMentor.full_name || 'Mentor';
      this.elements.mentorAvatar.src = this.currentMentor.profile_image_url || 'https://via.placeholder.com/40';

      // Load messages
      await this.loadMessages(roomId);

      // Join room
      this.socket.emit('joinChatRoom', { roomId, bookingId });

      // Mark as seen
      this.socket.emit('messageSeen', { roomId });

      // Show chat view
      this.elements.chatView.style.display = 'flex';
      this.elements.emptyState.style.display = 'none';
      this.elements.chatList.classList.remove('hidden');

      // Focus message input
      this.elements.messageInput.focus();

    } catch (error) {
      console.error('❌ Error selecting chat:', error);
      this.showToast('Failed to load chat', 'error');
    }
  }

  async loadMessages(roomId) {
    try {
      const token = localStorage.getItem('token') || this.getCookie('token');
      
      const response = await fetch(`/api/chat/messages/${roomId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load messages');

      const data = await response.json();
      this.messages = data.messages || [];
      
      this.renderMessages();
      this.scrollToBottom();
    } catch (error) {
      console.error('❌ Error loading messages:', error);
    }
  }

  renderMessages() {
    let html = '';
    let lastDate = null;

    this.messages.forEach(msg => {
      // Add date separator
      const messageDate = new Date(msg.createdAt).toLocaleDateString();
      if (lastDate !== messageDate) {
        html += `
          <div class="date-separator">
            <span>${messageDate}</span>
          </div>
        `;
        lastDate = messageDate;
      }

      const isSent = msg.senderId === this.currentUser.id;
      const content = this.decryptMessage(msg.message);

      html += `
        <div class="message-group ${isSent ? 'sent' : 'received'}">
          <div class="message-bubble ${isSent ? 'sent' : 'received'}">
            <div class="message-content">${this.escapeHtml(content)}</div>
            <div class="message-footer">
              <span class="message-time">${this.formatTime(msg.createdAt)}</span>
              ${isSent ? `
                <span class="message-status">
                  <i class="fas fa-check${msg.isSeen ? '-double' : ''}"></i>
                </span>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    });

    this.elements.messagesContainer.innerHTML = html || '<div class="empty-state"><p>No messages yet</p></div>';
    this.scrollToBottom();
  }

  // ========================================
  // MESSAGE SENDING
  // ========================================

  async sendMessage(text = null) {
    const message = text || this.elements.messageInput.value.trim();
    
    if (!message || !this.currentChat) return;

    try {
      const encryptedMessage = this.encryptMessage(message);
      
      const payload = {
        roomId: this.currentChat.roomId,
        message: encryptedMessage,
        senderId: this.currentUser.id,
        senderType: 'user',
        messageType: 'text',
        timestamp: new Date().toISOString()
      };

      // Send via Socket.IO
      this.socket.emit('sendMessage', payload);

      // Save to database
      const token = localStorage.getItem('token') || this.getCookie('token');
      await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      this.elements.messageInput.value = '';
      this.elements.messageInput.style.height = 'auto';
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      this.showToast('Failed to send message', 'error');
    }
  }

  // ========================================
  // MESSAGE ENCRYPTION/DECRYPTION
  // ========================================

  encryptMessage(text) {
    try {
      const encrypted = CryptoJS.AES.encrypt(text, this.encryptionKey.toString()).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      return text;
    }
  }

  decryptMessage(encryptedText) {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey.toString()).toString(CryptoJS.enc.Utf8);
      return decrypted || encryptedText;
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedText;
    }
  }

  // ========================================
  // SOCKET.IO EVENT HANDLERS
  // ========================================

  handleReceiveMessage(data) {
    if (data.roomId !== this.currentChat?.roomId) return;

    this.messages.push(data);
    this.renderMessages();
    this.scrollToBottom();
    
    // Play notification sound
    this.playNotificationSound();
  }

  handleTyping(data) {
    if (data.roomId !== this.currentChat?.roomId) return;
    
    this.elements.typingIndicator.style.display = 'flex';
    this.scrollToBottom();
    
    // Clear existing timeout
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.elements.typingIndicator.style.display = 'none';
    }, 3000);
  }

  handleStopTyping() {
    this.elements.typingIndicator.style.display = 'none';
  }

  handleMessageSeen(data) {
    // Mark messages as seen
    this.messages.forEach(msg => {
      if (msg.id === data.messageId) {
        msg.isSeen = true;
      }
    });
    this.renderMessages();
  }

  handleUserOnline(data) {
    if (data.userId === this.currentMentor?.id) {
      this.elements.mentorStatus.innerHTML = '<span class="status-dot"></span> Online';
    }
  }

  handleUserOffline(data) {
    if (data.userId === this.currentMentor?.id) {
      this.elements.mentorStatus.innerHTML = '<span class="status-dot offline"></span> Offline';
    }
  }

  handleUnreadCount(data) {
    this.elements.unreadCount.textContent = data.count;
  }

  // ========================================
  // WEBRTC & CALLING
  // ========================================

  async startCall(callType) {
    try {
      this.callType = callType;
      
      // Get user media
      const constraints = {
        audio: true,
        video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Setup peer connection
      await this.setupPeerConnection();
      
      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.socket.emit('callUser', {
        to: this.currentMentor.id,
        roomId: this.currentChat.roomId,
        callType: callType,
        offer: offer
      });

      this.showCallUI();

    } catch (error) {
      console.error('❌ Error starting call:', error);
      this.showToast('Failed to start call', 'error');
    }
  }

  handleIncomingCall(data) {
    this.callType = data.callType;
    this.socket.currentCallData = data;
    
    // Show incoming call modal
    const modal = new bootstrap.Modal(this.elements.incomingCallModal);
    document.getElementById('callName').textContent = this.currentMentor?.full_name || 'Mentor';
    document.getElementById('callType').textContent = data.callType === 'video' ? '📹 Video Call' : '☎️ Audio Call';
    document.getElementById('callAvatar').src = this.currentMentor?.profile_image_url || 'https://via.placeholder.com/120';
    
    modal.show();
  }

  async acceptCall() {
    try {
      const data = this.socket.currentCallData;
      
      // Get user media
      const constraints = {
        audio: true,
        video: data.callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Setup peer connection
      await this.setupPeerConnection();
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      
      // Create and send answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      this.socket.emit('acceptCall', {
        to: this.currentMentor.id,
        roomId: this.currentChat.roomId,
        answer: answer
      });

      this.showCallUI();

    } catch (error) {
      console.error('❌ Error accepting call:', error);
      this.showToast('Failed to accept call', 'error');
    }
  }

  async setupPeerConnection() {
    const configuration = {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] },
        { urls: ['stun:stun1.l.google.com:19302'] }
      ]
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.elements.remoteVideo.srcObject = this.remoteStream;
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('iceCandidate', {
          to: this.currentMentor.id,
          roomId: this.currentChat.roomId,
          candidate: event.candidate
        });
      }
    };

    // Display local video
    this.elements.localVideo.srcObject = this.localStream;
  }

  handleOffer(data) {
    this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
  }

  handleAnswer(data) {
    this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  }

  handleIceCandidate(data) {
    if (data.candidate) {
      this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }

  handleCallAccepted(data) {
    this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    this.showCallUI();
  }

  handleCallRejected() {
    this.showToast('Call rejected', 'info');
    this.endCall();
  }

  handleCallEnded() {
    this.endCall();
  }

  showCallUI() {
    this.callInProgress = true;
    this.callStartTime = Date.now();
    
    this.elements.chatView.style.display = 'none';
    this.elements.callContainer.style.display = 'flex';
    
    // Start call timer
    this.callTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      this.elements.callTimer.textContent = 
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);

    // Hide call modal if shown
    const modal = bootstrap.Modal.getInstance(this.elements.incomingCallModal);
    if (modal) modal.hide();
  }

  async endCall() {
    try {
      this.callInProgress = false;
      
      // Stop tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
      }

      // Close peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Clear timers
      if (this.callTimer) {
        clearInterval(this.callTimer);
      }

      // Notify other user
      this.socket.emit('callEnded', {
        to: this.currentMentor.id,
        roomId: this.currentChat.roomId,
        duration: Math.floor((Date.now() - this.callStartTime) / 1000)
      });

      // Save call log
      await this.saveCallLog();

      // Reset UI
      this.elements.callContainer.style.display = 'none';
      this.elements.chatView.style.display = 'flex';
      this.elements.remoteVideo.srcObject = null;
      this.elements.localVideo.srcObject = null;

    } catch (error) {
      console.error('❌ Error ending call:', error);
    }
  }

  async saveCallLog() {
    try {
      const token = localStorage.getItem('token') || this.getCookie('token');
      
      await fetch('/api/chat/call-log', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomId: this.currentChat.roomId,
          callType: this.callType,
          duration: Math.floor((Date.now() - this.callStartTime) / 1000),
          status: 'completed'
        })
      });
    } catch (error) {
      console.error('Error saving call log:', error);
    }
  }

  // ========================================
  // UI UTILITIES
  // ========================================

  insertEmoji(emoji) {
    this.elements.messageInput.value += emoji;
    this.elements.messageInput.focus();
    this.elements.emojiPicker.style.display = 'none';
  }

  scrollToBottom() {
    setTimeout(() => {
      this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    }, 0);
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    
    return date.toLocaleDateString();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    `;

    this.elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  playNotificationSound() {
    // Use Web Audio API to play a simple beep
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }

  // ========================================
  // EVENT LISTENERS
  // ========================================

  setupEventListeners() {
    // Message sending
    this.elements.btnSendMessage.addEventListener('click', () => this.sendMessage());
    this.elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    this.elements.messageInput.addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
      
      // Emit typing event
      if (!this.isTyping) {
        this.isTyping = true;
        this.socket.emit('typing', { roomId: this.currentChat?.roomId });
        
        setTimeout(() => {
          this.isTyping = false;
          this.socket.emit('stopTyping', { roomId: this.currentChat?.roomId });
        }, 3000);
      }
    });

    // Search
    this.elements.searchChats.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('.chat-item').forEach(item => {
        const name = item.querySelector('.chat-name').textContent.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
      });
    });

    // Call buttons
    this.elements.btnAudioCall?.addEventListener('click', () => this.startCall('audio'));
    this.elements.btnVideoCall?.addEventListener('click', () => this.startCall('video'));
    this.elements.btnAcceptCall?.addEventListener('click', () => this.acceptCall());
    this.elements.btnRejectCall?.addEventListener('click', () => {
      const modal = bootstrap.Modal.getInstance(this.elements.incomingCallModal);
      modal.hide();
      this.socket.emit('rejectCall', {
        to: this.currentMentor.id,
        roomId: this.currentChat.roomId
      });
    });

    // Call controls
    this.elements.btnMuteMic?.addEventListener('click', (e) => {
      const muted = !this.elements.btnMuteMic.classList.contains('active');
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach(track => {
          track.enabled = muted;
        });
      }
      this.elements.btnMuteMic.classList.toggle('active');
    });

    this.elements.btnEndCall?.addEventListener('click', () => this.endCall());

    // Composer buttons
    this.elements.btnEmoji?.addEventListener('click', () => {
      this.elements.emojiPicker.style.display = 
        this.elements.emojiPicker.style.display === 'none' ? 'block' : 'none';
    });

    this.elements.btnAttach?.addEventListener('click', () => {
      this.elements.fileInput.click();
    });

    // Back button (mobile)
    this.elements.btnBack?.addEventListener('click', () => {
      this.elements.chatView.style.display = 'none';
      this.elements.emptyState.style.display = 'flex';
      this.currentChat = null;
    });

    // Click outside emoji picker
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.emoji-picker') && !e.target.closest('#btnEmoji')) {
        this.elements.emojiPicker.style.display = 'none';
      }
    });
  }
}

// ========================================
// INITIALIZE APP
// ========================================

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new MyChatApp();
});