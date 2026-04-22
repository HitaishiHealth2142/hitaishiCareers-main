const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { query } = require('../db');
const { sendEmailAsync, sendUserRegistrationEmail } = require('../services/emailService');

// Google OAuth Setup
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.GOOGLE_ANDROID_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Utility: Hash refresh token using SHA256
 */
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Utility: Generate Access and Refresh Tokens
 */
const generateTokens = async (userId, role) => {
    const accessToken = jwt.sign(
        { id: userId, role: role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const hashedRefreshToken = hashToken(refreshToken);

    // Set expiry (default 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Store hashed token in DB
    await query(
        'INSERT INTO refresh_tokens (user_id, role, token_hash, expires_at) VALUES (?, ?, ?, ?)',
        [userId, role, hashedRefreshToken, expiresAt]
    );

    return { accessToken, refreshToken };
};

/**
 * Common Login Logic
 */
const performLogin = async (user, role, res) => {
    const { accessToken, refreshToken } = await generateTokens(user.id, role);

    return res.status(200).json({
        success: true,
        message: 'Login successful!',
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            role: role,
            email: user.email || user.user_email,
            name: user.full_name || user.company_name || 'Admin'
        }
    });
};

exports.performLogin = performLogin;
exports.generateTokens = generateTokens;


/**
 * REGISTER (Candidates)
 */
exports.register = async (req, res) => {
    try {
        const { fullName, email, mobileNumber, password } = req.body;
        if (!fullName || !email || !mobileNumber || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        const existing = await query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) return res.status(409).json({ success: false, message: 'Email already registered.' });

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const profileImage = req.file ? `/uploads/${req.file.filename}` : null;

        const result = await query(
            'INSERT INTO users (full_name, email, mobile_number, password_hash, profile_image_url, auth_provider) VALUES (?, ?, ?, ?, ?, ?)',
            [fullName, email, mobileNumber, passwordHash, profileImage, 'local']
        );

        if (sendEmailAsync && sendUserRegistrationEmail) {
            sendEmailAsync(() => sendUserRegistrationEmail({ fullName, email }));
        }

        return await performLogin({ id: result.insertId, email, full_name: fullName }, 'user', res);
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
};

/**
 * LOGIN (Candidates)
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = await query('SELECT * FROM users WHERE email = ?', [email]);
        if (!users.length) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

        return await performLogin(user, 'user', res);
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
};

/**
 * REFRESH TOKEN
 */
exports.refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(401).json({ success: false, message: 'Refresh token required.' });

        const hashedToken = hashToken(refreshToken);
        const results = await query('SELECT * FROM refresh_tokens WHERE token_hash = ?', [hashedToken]);

        if (results.length === 0) return res.status(403).json({ success: false, message: 'Invalid refresh token.' });

        const session = results[0];
        if (new Date() > new Date(session.expires_at)) {
            await query('DELETE FROM refresh_tokens WHERE id = ?', [session.id]);
            return res.status(401).json({ success: false, message: 'Refresh token expired. Please login again.' });
        }

        // Generate new Access Token
        const accessToken = jwt.sign(
            { id: session.user_id, role: session.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '30m' }
        );

        res.json({ success: true, accessToken });
    } catch (error) {
        console.error('Refresh Error:', error);
        res.status(500).json({ success: false, message: 'Server error during token refresh.' });
    }
};

/**
 * LOGOUT
 */
exports.logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            const hashedToken = hashToken(refreshToken);
            await query('DELETE FROM refresh_tokens WHERE token_hash = ?', [hashedToken]);
        }

        res.status(200).json({ success: true, message: 'Logged out successfully.' });
    } catch (error) {
        console.error('Logout Error:', error);
        res.status(500).json({ success: false, message: 'Server error during logout.' });
    }
};

/**
 * GOOGLE LOGIN
 */
exports.googleLogin = async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Google token required.' });

    try {
        const VALID_AUDIENCES = [GOOGLE_CLIENT_ID];
        if (GOOGLE_ANDROID_CLIENT_ID) VALID_AUDIENCES.push(GOOGLE_ANDROID_CLIENT_ID);

        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: VALID_AUDIENCES,
        });

        const payload = ticket.getPayload();
        if (!payload) return res.status(401).json({ success: false, message: 'Invalid Google token.' });

        const email = payload.email;
        const existing = await query('SELECT * FROM users WHERE email = ?', [email]);
        let user;

        if (existing.length > 0) {
            user = existing[0];
        } else {
            const result = await query(
                'INSERT INTO users (full_name, email, google_id, profile_image_url, auth_provider) VALUES (?, ?, ?, ?, ?)',
                [payload.name, email, payload.sub, payload.picture, 'google']
            );
            user = { id: result.insertId, email, full_name: payload.name };
        }

        return await performLogin(user, 'user', res);
    } catch (err) {
        console.error('Google Auth error:', err);
        res.status(500).json({ success: false, message: 'Server error during Google authentication.' });
    }
};
