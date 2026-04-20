// routes/register.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db');
const authController = require('../controllers/authController');
const router = express.Router();

// --- Ensure 'uploads' directory exists ---
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// --- Multer Setup for File Uploads ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { 
        fileSize: 20 * 1024 * 1024, // 20 MB limit
    }
});

// --- Secure Registration Route with centralized controller ---
router.post('/user/register', upload.single('profileImage'), authController.register);

// --- Secure Login Route with centralized controller ---
router.post('/user/login', authController.login);


// --- UNPROTECTED: GET all users ---
// **IMPORTANT**: Keep this route UNPROTECTED in your main server configuration.
router.get('/jobseekers', async (req, res) => {
    try {
        // Fetch all users (complete rows)
        const rows = await query(`
            SELECT * FROM users
            ORDER BY created_at DESC
        `);

        // Optional: You can still ensure JSON-safe parsing if some columns contain JSON strings
        const jobseekers = rows.map(user => {
            const tryParse = (val) => {
                try {
                    return JSON.parse(val);
                } catch {
                    return val;
                }
            };

            // Auto-parse potential JSON fields (optional safeguard)
            for (let key in user) {
                // FIX: Added parentheses to ensure .startsWith is only called on a string.
                // The previous logic was causing a TypeError if user[key] was not a string
                // due to incorrect operator precedence of && and ||.
                if (typeof user[key] === 'string' && (user[key].startsWith('[') || user[key].startsWith('{'))) {
                    user[key] = tryParse(user[key]);
                }
            }

            return user;
        });

        res.json({ jobseekers });
    } catch (err) {
        console.error("❌ Error fetching all users:", err);
        res.status(500).json({ error: 'Server error while fetching users list' });
    }
});

// --- Secure Password Update Route ---
// router.post('/user/update-password', async (req, res) => {
//   try {
//     // Note: protectRoute middleware should be applied to this route in server.js
//     // For now, let's assume req.user is populated by the middleware.
//     const email = req.user?.email;
//     const newPassword = req.body?.newPassword;
//     if (!newPassword) return res.status(400).json({ error: 'New password required' });

//     if (!email) return res.status(401).json({ error: 'Not authenticated' });

//     const users = await query('SELECT * FROM users WHERE email = ?', [email]);
//     if (!users.length) return res.status(404).json({ error: 'User not found' });

//     if (users[0].auth_provider === 'google') {
//       return res.status(403).json({ error: 'Cannot change password for Google-auth accounts' });
//     }

//     const newHashedPassword = await bcrypt.hash(newPassword, saltRounds);
//     await query('UPDATE users SET password_hash = ? WHERE email = ?', [newHashedPassword, email]);

//     res.status(200).json({ message: 'Password updated successfully.' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'An error occurred on the server.' });
//   }
// });


// --- UPDATED Logout Route ---

router.post('/logout', (req, res) => {
    // To log out, we clear the JWT HttpOnly cookie.
    res.cookie('token', '', {
        httpOnly: true,
        expires: new Date(0), // Set expiry date to the past
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.status(200).json({ message: 'Logout successful!' });
});

module.exports = router;
