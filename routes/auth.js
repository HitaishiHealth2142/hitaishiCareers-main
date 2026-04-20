// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Registration (Candidate)
router.post('/register', authController.register);

// Login (Candidate)
router.post('/login', authController.login);

// Google Auth (Candidate)
router.post('/google', authController.googleLogin);

// Refresh Token (Unified)
router.post('/refresh', authController.refresh);

// Logout (Unified)
router.post('/logout', authController.logout);

module.exports = router;


