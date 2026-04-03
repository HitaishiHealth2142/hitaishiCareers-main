// server.js - Updated with Socket.IO & Chat
require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');

const registerRoute = require('./routes/register');
const authRoute = require('./routes/auth');
const profileRoute = require('./routes/profile');
const jobsRoute = require('./routes/jobs');
const applicantRoute = require('./routes/applicant');
const companyRoute = require('./routes/company');
const mentorsRoute = require('./routes/mentors');
const chatRoute = require('./routes/chat');
const { protectRoute, protectEmployerRoute } = require('./middleware/authMiddleware');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: [
      'https://www.winjob.in',
      'https://winjob.in',
      'http://localhost:5003',
      'http://localhost:8100',
      'http://localhost:8080',
      'http://127.0.0.1:8000',
      'capacitor://localhost',
      'ionic://localhost',
      'http://localhost',
      'https://localhost',
      'file://'
    ],
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS']
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

const PORT = process.env.PORT || 5003;

// ========================================
// CORS CONFIGURATION
// ========================================

const allowedOrigins = [
  'https://www.winjob.in',
  'https://winjob.in',
  'http://localhost:5003',
  'http://localhost:8100',
  'http://localhost:8080',
  'http://127.0.0.1:8000',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
  'file://'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) {
      console.log('CORS: Allowing request with null origin (Native App or Tool).');
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      console.log(`CORS: Allowing origin ${origin}`);
      return callback(null, true);
    }

    console.warn(`CORS: Rejecting forbidden origin: ${origin}`);
    callback(new Error(`CORS policy: origin not allowed`), false);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// ========================================
// MIDDLEWARE
// ========================================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Static Files
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========================================
// SOCKET.IO INITIALIZATION
// ========================================

require('./socket')(io, app);

// Middleware to attach io to requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Socket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const userId = socket.handshake.auth.userId;

  if (!token || !userId) {
    // Allow anonymous connections for now
    // In production, verify JWT token here
    socket.handshake.auth.userId = userId || null;
  }

  next();
});

// ========================================
// API ROUTES
// ========================================

app.use('/api', registerRoute);
app.use('/api/auth', authRoute);
app.use('/api/profile', protectRoute, profileRoute);
app.use('/api/jobs', jobsRoute);
app.use('/api/applicant', applicantRoute);
app.use('/api/company', companyRoute);
app.use('/api/mentors', mentorsRoute);
app.use('/api/chat', chatRoute); // Chat routes

// ========================================
// FRONTEND ROUTES
// ========================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/mychat', (req, res) => {
  res.sendFile(path.join(__dirname, 'mychat.html'));
});

// ========================================
// HEALTH CHECK
// ========================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'WinJob API Server',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ========================================
// ERROR HANDLING
// ========================================

app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist',
    path: req.path
  });
});

// ========================================
// SERVER STARTUP
// ========================================

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║    🚀 WinJob Server is Running 🚀     ║
╠════════════════════════════════════════╣
║  Port: ${PORT}                              ║
║  Environment: ${process.env.NODE_ENV || 'development'}                ║
║  Socket.IO: ✅ Enabled                 ║
║  Chat System: ✅ Enabled                ║
║  WebRTC Calling: ✅ Enabled            ║
╚════════════════════════════════════════╝
  `);
  
  console.log('✅ Server is listening on port:', PORT);
  console.log('✅ Socket.IO is running');
  console.log('✅ Chat & Call system initialized');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };