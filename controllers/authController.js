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
const generateTokens = async (userId, role, email) => {
    const accessToken = jwt.sign(
        { id: userId, role: role, email: email },
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
        'INSERT INTO refresh_tokens (user_id, role, email, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
        [userId, role, email, hashedRefreshToken, expiresAt]
    );

    return { accessToken, refreshToken };
};

/**
 * Common Login Logic
 */
const performLogin = async (user, role, res) => {
    const email = user.email || user.user_email || user.admin_email; // Handle different email field names
    const { accessToken, refreshToken } = await generateTokens(user.id, role, email);

    return res.status(200).json({
        success: true,
        message: 'Login successful!',
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            role: role,
            email: email,
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
            { id: session.user_id, role: session.role, email: session.email },
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
/**
 * FORGOT PASSWORD - Step 1: Request OTP
 */
exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

        // Check if email exists in any of the tables
        const candidate = await query('SELECT email FROM users WHERE email = ?', [email]);
        const company = await query('SELECT user_email FROM companies WHERE user_email = ?', [email]);
        const mentor = await query('SELECT email FROM mentors WHERE email = ?', [email]);
        const admin = await query('SELECT email FROM admins WHERE email = ?', [email]);

        if (candidate.length === 0 && company.length === 0 && mentor.length === 0 && admin.length === 0) {
            return res.status(404).json({ success: false, message: 'Email not found.' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        const otpId = crypto.randomBytes(20).toString('hex');
        
        // OTP valid for 10 minutes
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Store OTP in database
        await query(
            'INSERT INTO password_reset_otps (id, email, otp_hash, expires_at) VALUES (?, ?, ?, ?)',
            [otpId, email, otpHash, expiresAt]
        );

        // Send OTP email
        const { sendEmailAsync, sendPasswordResetOTPEmail } = require('../services/emailService');
        if (sendEmailAsync && sendPasswordResetOTPEmail) {
            sendEmailAsync(() => sendPasswordResetOTPEmail(email, otp));
        }

        // For development, log the OTP
        if (process.env.NODE_ENV === 'development') {
            console.log(`[DEV] Password Reset OTP for ${email}: ${otp}`);
        }

        res.json({ success: true, message: 'Verification code sent to your email.' });
    } catch (error) {
        console.error('Request Reset Error:', error);
        res.status(500).json({ success: false, message: 'Server error during password reset request.' });
    }
};

/**
 * FORGOT PASSWORD - Step 2: Verify OTP
 */
exports.verifyResetOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required.' });

        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        const results = await query(
            'SELECT * FROM password_reset_otps WHERE email = ? AND otp_hash = ? AND is_used = FALSE ORDER BY created_at DESC LIMIT 1',
            [email, otpHash]
        );

        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid verification code.' });
        }

        const record = results[0];
        if (new Date() > new Date(record.expires_at)) {
            return res.status(401).json({ success: false, message: 'Verification code expired.' });
        }

        res.json({ success: true, message: 'Code verified successfully.' });
    } catch (error) {
        console.error('Verify OTP Error:', error);
        res.status(500).json({ success: false, message: 'Server error during OTP verification.' });
    }
};

/**
 * FORGOT PASSWORD - Step 3: Reset Password
 */
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        // 1. Verify OTP again for security
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        const results = await query(
            'SELECT * FROM password_reset_otps WHERE email = ? AND otp_hash = ? AND is_used = FALSE ORDER BY created_at DESC LIMIT 1',
            [email, otpHash]
        );

        if (results.length === 0 || new Date() > new Date(results[0].expires_at)) {
            return res.status(401).json({ success: false, message: 'Session expired or invalid. Please try again.' });
        }

        const record = results[0];

        // 2. Hash new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        // 3. Update password in the correct table
        let updated = false;
        
        // Try Candidate
        const resUser = await query('UPDATE users SET password_hash = ? WHERE email = ?', [passwordHash, email]);
        if (resUser.affectedRows > 0) updated = true;
        
        // Try Employer (if not already updated)
        if (!updated) {
            const resCompany = await query('UPDATE companies SET password_hash = ? WHERE user_email = ?', [passwordHash, email]);
            if (resCompany.affectedRows > 0) updated = true;
        }

        // Try Mentor
        if (!updated) {
            const resMentor = await query('UPDATE mentors SET password_hash = ? WHERE email = ?', [passwordHash, email]);
            if (resMentor.affectedRows > 0) updated = true;
        }

        // Try Admin
        if (!updated) {
            const resAdmin = await query('UPDATE admins SET password_hash = ? WHERE email = ?', [passwordHash, email]);
            if (resAdmin.affectedRows > 0) updated = true;
        }

        if (!updated) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // 4. Mark OTP as used
        await query('UPDATE password_reset_otps SET is_used = TRUE WHERE id = ?', [record.id]);

        res.json({ success: true, message: 'Password reset successfully. You can now login.' });
    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ success: false, message: 'Server error during password reset.' });
    }
};
