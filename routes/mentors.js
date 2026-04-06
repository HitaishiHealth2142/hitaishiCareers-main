const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const protectMentorRoute = require('../middleware/mentorAuthMiddleware');
const Razorpay = require('razorpay');
const { query } = require('../db');
const { protectRoute: verifyUser } = require('../middleware/authMiddleware');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ==========================================
// MULTER CONFIGURATION
// ==========================================

const uploadDir = path.join(__dirname, '../uploads/mentors');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `mentor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
    }
  },
});

// ==========================================
// AUTO TABLE CREATION & MIGRATIONS
// ==========================================

async function initializeMentorTables() {
  try {
    // =========================
    // mentors table
    // =========================
    const createMentorsTableSQL = `
      CREATE TABLE IF NOT EXISTS mentors (
        id CHAR(36) PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        current_company VARCHAR(255),
        experience_years INT,
        expertise JSON,
        bio TEXT,
        linkedin_url VARCHAR(500),
        profile_image_url VARCHAR(500),
        hourly_price DECIMAL(10,2),
        available_slots JSON,
        rating DECIMAL(2,1) DEFAULT 0,
        total_sessions INT DEFAULT 0,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_rating (rating),
        INDEX idx_is_verified (is_verified)
      );
    `;

    // =========================
    // mentor bookings table
    // =========================
    const createBookingsTableSQL = `
      CREATE TABLE IF NOT EXISTS mentor_bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        mentor_id CHAR(36) NOT NULL,
        razorpay_order_id VARCHAR(255),
        razorpay_payment_id VARCHAR(255),
        payment_status VARCHAR(50) DEFAULT 'pending',
        booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_mentor_id (mentor_id),
        INDEX idx_payment_status (payment_status)
      );
    `;

    await query(createMentorsTableSQL);
    await query(createBookingsTableSQL);

    // Add session and payment metadata if missing from existing table
    await query(`ALTER TABLE mentor_bookings ADD COLUMN IF NOT EXISTS session_start DATETIME DEFAULT NULL`);
    await query(`ALTER TABLE mentor_bookings ADD COLUMN IF NOT EXISTS session_end DATETIME DEFAULT NULL`);
    await query(`ALTER TABLE mentor_bookings ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2) DEFAULT NULL`);
    await query(`ALTER TABLE mentor_bookings ADD COLUMN IF NOT EXISTS session_status VARCHAR(50) DEFAULT 'pending'`);
    await query(`ALTER TABLE mentor_bookings ADD COLUMN IF NOT EXISTS room_id INT DEFAULT NULL`);

    console.log("✅ Mentors table initialized");
    console.log("✅ Mentor bookings table initialized");
  } catch (error) {
    console.error("❌ Table initialization error:", error);
  }
}


initializeMentorTables();

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Sanitize string input to prevent XSS
 */
function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate JWT Token
 */
function generateToken(mentorId) {
  return jwt.sign(
    { mentorId },
    process.env.JWT_SECRET || 'mentor_jwt_secret_key',
    { expiresIn: '7d' }
  );
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
function isStrongPassword(password) {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

// ==========================================
// POST /api/mentor/register
// ==========================================
router.post('/register', upload.single('profile_image'), async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      title,
      current_company,
      experience_years,
      expertise,
      bio,
      linkedin_url,
      hourly_price,
      available_slots,
    } = req.body;

    // Validation
    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and password are required',
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters with uppercase and numbers',
      });
    }

    // Check for duplicate email
    const [existingMentor] = await query(
      'SELECT id FROM mentors WHERE email = ?',
      [email]
    );

    if (existingMentor) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate mentor ID
    const mentorId = uuidv4();

    // Parse expertise
    let expertiseArray = [];
    if (expertise) {
      expertiseArray = Array.isArray(expertise)
        ? expertise
        : typeof expertise === 'string'
        ? expertise.split(',').map(e => e.trim())
        : [];
    }

    // Parse available slots
    let slotsObj = null;
    if (available_slots) {
      try {
        slotsObj = typeof available_slots === 'string' 
          ? JSON.parse(available_slots) 
          : available_slots;
      } catch (e) {
        slotsObj = null;
      }
    }

    // Handle profile image
    let profileImageUrl = null;
    if (req.file) {
      profileImageUrl = `/uploads/mentors/${req.file.filename}`;
    }

    // Insert mentor
    await query(
      `INSERT INTO mentors (
        id, full_name, email, password_hash, title, current_company,
        experience_years, expertise, bio, linkedin_url, profile_image_url,
        hourly_price, available_slots
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mentorId,
        sanitize(full_name),
        email.toLowerCase(),
        hashedPassword,
        sanitize(title) || null,
        sanitize(current_company) || null,
        experience_years ? parseInt(experience_years) : null,
        JSON.stringify(expertiseArray),
        sanitize(bio) || null,
        sanitize(linkedin_url) || null,
        profileImageUrl,
        hourly_price ? parseFloat(hourly_price) : null,
        slotsObj ? JSON.stringify(slotsObj) : null,
      ]
    );

    // Generate JWT
    const token = generateToken(mentorId);

    // Set secure cookie
    res.cookie('mentorToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return response
    return res.status(201).json({
      success: true,
      message: 'Mentor registered successfully',
      mentor: {
        id: mentorId,
        full_name,
        email,
        title,
        current_company,
        experience_years,
        expertise: expertiseArray,
        profile_image_url: profileImageUrl,
        hourly_price,
      },
      token, // For mobile support
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register mentor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// ==========================================
// POST /api/mentor/login
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find mentor
    const [mentor] = await query(
      'SELECT * FROM mentors WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!mentor) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Compare password
    const passwordMatch = await bcrypt.compare(password, mentor.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate JWT
    const token = generateToken(mentor.id);

    // Set secure cookie
    const maxAge = rememberMe 
      ? 30 * 24 * 60 * 60 * 1000 // 30 days
      : 7 * 24 * 60 * 60 * 1000;  // 7 days

    res.cookie('mentorToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge,
    });

    // Parse expertise and slots
    const expertise = mentor.expertise ? JSON.parse(mentor.expertise) : [];
    const available_slots = mentor.available_slots ? JSON.parse(mentor.available_slots) : null;

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      mentor: {
        id: mentor.id,
        full_name: mentor.full_name,
        email: mentor.email,
        title: mentor.title,
        current_company: mentor.current_company,
        experience_years: mentor.experience_years,
        expertise,
        bio: mentor.bio,
        linkedin_url: mentor.linkedin_url,
        profile_image_url: mentor.profile_image_url,
        hourly_price: mentor.hourly_price,
        available_slots,
        rating: mentor.rating,
        total_sessions: mentor.total_sessions,
        is_verified: mentor.is_verified,
      },
      token, // For mobile support
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// ==========================================
// POST /api/mentor/logout
// ==========================================
router.post('/logout', (req, res) => {
  try {
    res.clearCookie('mentorToken');
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
});

// ==========================================
// GET /api/mentor/profile
// ==========================================
router.get('/profile', protectMentorRoute, async (req, res) => {
  try {
    const [mentor] = await query(
      'SELECT * FROM mentors WHERE id = ?',
      [req.mentor.id]
    );

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found',
      });
    }

    const expertise = mentor.expertise ? JSON.parse(mentor.expertise) : [];
    const available_slots = mentor.available_slots ? JSON.parse(mentor.available_slots) : null;

    // Calculate profile completion percentage
    const fields = [
      mentor.title,
      mentor.current_company,
      mentor.experience_years,
      mentor.bio,
      mentor.linkedin_url,
      mentor.profile_image_url,
      mentor.hourly_price,
      expertise.length > 0,
      available_slots,
    ];
    const profileCompletion = Math.round((fields.filter(f => f).length / fields.length) * 100);

    return res.status(200).json({
      success: true,
      mentor: {
        id: mentor.id,
        full_name: mentor.full_name,
        email: mentor.email,
        title: mentor.title,
        current_company: mentor.current_company,
        experience_years: mentor.experience_years,
        expertise,
        bio: mentor.bio,
        linkedin_url: mentor.linkedin_url,
        profile_image_url: mentor.profile_image_url,
        hourly_price: mentor.hourly_price,
        available_slots,
        rating: mentor.rating,
        total_sessions: mentor.total_sessions,
        is_verified: mentor.is_verified,
        created_at: mentor.created_at,
        profileCompletion,
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// ==========================================
// PATCH /api/mentor/profile
// ==========================================
router.patch('/profile', protectMentorRoute, upload.single('profile_image'), async (req, res) => {
  try {
    const {
      full_name,
      title,
      current_company,
      experience_years,
      expertise,
      bio,
      linkedin_url,
      hourly_price,
      available_slots,
    } = req.body;

    // Get current mentor
    const [currentMentor] = await query(
      'SELECT * FROM mentors WHERE id = ?',
      [req.mentor.id]
    );

    if (!currentMentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found',
      });
    }

    // Prepare update data
    const updateData = {};
    if (full_name) updateData.full_name = sanitize(full_name);
    if (title !== undefined) updateData.title = sanitize(title) || null;
    if (current_company !== undefined) updateData.current_company = sanitize(current_company) || null;
    if (experience_years !== undefined) updateData.experience_years = experience_years ? parseInt(experience_years) : null;
    if (bio !== undefined) updateData.bio = sanitize(bio) || null;
    if (linkedin_url !== undefined) updateData.linkedin_url = sanitize(linkedin_url) || null;
    if (hourly_price !== undefined) updateData.hourly_price = hourly_price ? parseFloat(hourly_price) : null;

    // Parse expertise
    if (expertise !== undefined) {
      const expertiseArray = Array.isArray(expertise)
        ? expertise
        : typeof expertise === 'string'
        ? expertise.split(',').map(e => e.trim())
        : [];
      updateData.expertise = JSON.stringify(expertiseArray);
    }

    // Parse available slots
    if (available_slots !== undefined) {
      try {
        const slotsObj = typeof available_slots === 'string' 
          ? JSON.parse(available_slots) 
          : available_slots;
        updateData.available_slots = JSON.stringify(slotsObj);
      } catch (e) {
        // Keep existing slots if parsing fails
      }
    }

    // Handle profile image
    if (req.file) {
      // Delete old image if exists
      if (currentMentor.profile_image_url) {
        const oldPath = path.join(__dirname, '../public', currentMentor.profile_image_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      updateData.profile_image_url = `/uploads/mentors/${req.file.filename}`;
    }

    // Build update query
    const setClause = Object.keys(updateData)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = [...Object.values(updateData), req.mentor.id];

    await query(
      `UPDATE mentors SET ${setClause} WHERE id = ?`,
      values
    );

    // Fetch updated mentor
    const [updatedMentor] = await query(
      'SELECT * FROM mentors WHERE id = ?',
      [req.mentor.id]
    );

    const expertise_parsed = updatedMentor.expertise ? JSON.parse(updatedMentor.expertise) : [];
    const available_slots_parsed = updatedMentor.available_slots ? JSON.parse(updatedMentor.available_slots) : null;

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      mentor: {
        id: updatedMentor.id,
        full_name: updatedMentor.full_name,
        email: updatedMentor.email,
        title: updatedMentor.title,
        current_company: updatedMentor.current_company,
        experience_years: updatedMentor.experience_years,
        expertise: expertise_parsed,
        bio: updatedMentor.bio,
        linkedin_url: updatedMentor.linkedin_url,
        profile_image_url: updatedMentor.profile_image_url,
        hourly_price: updatedMentor.hourly_price,
        available_slots: available_slots_parsed,
        rating: updatedMentor.rating,
        total_sessions: updatedMentor.total_sessions,
        is_verified: updatedMentor.is_verified,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// ==========================================
// GET /api/mentor/all
// ==========================================
router.get('/all', async (req, res) => {
  try {
    const { page = 1, limit = 12, expertise, minRating = 0, maxPrice } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE is_verified = true';
    const queryParams = [];

    // Filter by expertise
    if (expertise) {
      whereClause += ` AND expertise LIKE ?`;
      queryParams.push(`%${expertise}%`);
    }

    // Filter by rating
    if (minRating) {
      whereClause += ` AND rating >= ?`;
      queryParams.push(parseFloat(minRating));
    }

    // Filter by price
    if (maxPrice) {
      whereClause += ` AND hourly_price <= ?`;
      queryParams.push(parseFloat(maxPrice));
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM mentors ${whereClause}`,
      queryParams
    );
    const total = countResult[0]?.total || 0;

    // Get mentors
    const mentors = await query(
      `SELECT * FROM mentors ${whereClause} ORDER BY rating DESC, total_sessions DESC LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), offset]
    );

    const parsedMentors = mentors.map(m => ({
      id: m.id,
      full_name: m.full_name,
      title: m.title,
      current_company: m.current_company,
      experience_years: m.experience_years,
      expertise: m.expertise ? JSON.parse(m.expertise) : [],
      bio: m.bio,
      profile_image_url: m.profile_image_url,
      hourly_price: m.hourly_price,
      rating: m.rating,
      total_sessions: m.total_sessions,
    }));

    return res.status(200).json({
      success: true,
      mentors: parsedMentors,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Mentors list error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch mentors',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// ==========================================
// GET /api/mentor/:id
// ==========================================
router.get('/:id', async (req, res) => {
  try {
    const [mentor] = await query(
      'SELECT * FROM mentors WHERE id = ? AND is_verified = true',
      [req.params.id]
    );

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found',
      });
    }

    const expertise = mentor.expertise ? JSON.parse(mentor.expertise) : [];

    return res.status(200).json({
      success: true,
      mentor: {
        id: mentor.id,
        full_name: mentor.full_name,
        title: mentor.title,
        current_company: mentor.current_company,
        experience_years: mentor.experience_years,
        expertise,
        bio: mentor.bio,
        linkedin_url: mentor.linkedin_url,
        profile_image_url: mentor.profile_image_url,
        hourly_price: mentor.hourly_price,
        rating: mentor.rating,
        total_sessions: mentor.total_sessions,
      },
    });
  } catch (error) {
    console.error('Single mentor fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch mentor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// ==========================================
// GET /api/mentors/booking/:bookingId
// ==========================================
router.get('/booking/:bookingId', verifyUser, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const [booking] = await query(
      `SELECT b.*, m.full_name, m.profile_image_url, m.title, m.current_company, m.hourly_price, m.expertise, r.id AS roomId
       FROM mentor_bookings b
       JOIN mentors m ON b.mentor_id = m.id
       LEFT JOIN mentor_chat_rooms r ON r.booking_id = b.id
       WHERE b.id = ? AND b.user_id = ?`,
      [bookingId, userId]
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const now = new Date();
    const endTime = booking.session_end ? new Date(booking.session_end) : null;
    const sessionActive = booking.payment_status === 'paid' && endTime && endTime > now;
    const remainingSeconds = sessionActive ? Math.floor((endTime - now) / 1000) : 0;

    return res.status(200).json({
      success: true,
      booking: {
        id: booking.id,
        mentorId: booking.mentor_id,
        mentorName: booking.full_name,
        mentorAvatar: booking.profile_image_url,
        hourlyPrice: booking.hourly_price,
        paymentStatus: booking.payment_status,
        sessionStatus: booking.session_status,
        sessionStart: booking.session_start,
        sessionEnd: booking.session_end,
        remainingSeconds,
        roomId: booking.roomId,
      }
    });
  } catch (error) {
    console.error('Booking detail error:', error);
    res.status(500).json({ success: false, message: 'Failed to load booking details' });
  }
});

// ==========================================
// GET /api/mentor/dashboard/stats
// ==========================================
router.get('/dashboard/stats', protectMentorRoute, async (req, res) => {
  try {
    const [mentor] = await query(
      'SELECT * FROM mentors WHERE id = ?',
      [req.mentor.id]
    );

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found',
      });
    }

    const bookings = await query(
      `SELECT *,
              CASE
                WHEN payment_status = 'paid' AND session_end > NOW() THEN 'active'
                WHEN payment_status = 'paid' AND session_end <= NOW() THEN 'completed'
                ELSE 'pending'
              END AS computed_status
       FROM mentor_bookings
       WHERE mentor_id = ?`,
      [req.mentor.id]
    );

    const activeSessions = bookings.filter(b => b.computed_status === 'active').length;
    const completedSessions = bookings.filter(b => b.computed_status === 'completed').length;
    const totalEarnings = bookings.reduce((sum, booking) => sum + (parseFloat(booking.amount) || 0), 0);

    const upcomingBookings = bookings
      .filter(b => b.computed_status === 'active')
      .slice(0, 3)
      .map(b => ({
        bookingId: b.id,
        amount: parseFloat(b.amount) || 0,
        sessionStart: b.session_start,
        sessionEnd: b.session_end,
        status: b.computed_status
      }));

    return res.status(200).json({
      success: true,
      stats: {
        totalSessions: mentor.total_sessions || 0,
        rating: mentor.rating || 0,
        activeSessions,
        upcomingBookings,
        completedSessions,
        estimatedEarnings: totalEarnings,
        profileCompletion: Math.round(
          ([mentor.title, mentor.current_company, mentor.experience_years, mentor.bio, mentor.linkedin_url, mentor.profile_image_url, mentor.hourly_price, mentor.expertise, mentor.available_slots].filter(Boolean).length / 9) * 100
        )
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});


// create order for mentorship session
router.post('/create-order', verifyUser, async (req, res) => {
  const { mentorId, amount } = req.body;

  const order = await razorpay.orders.create({
    amount: amount * 100,
    currency: "INR",
    receipt: `mentor_${mentorId}_${Date.now()}`
  });

  res.json({
    orderId: order.id,
    amount: order.amount
  });
});

// success payment saves in table
router.post('/payment-success', verifyUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      mentorId,
      razorpay_order_id,
      razorpay_payment_id,
      amount,
      bookingId: existingBookingId
    } = req.body;

    if (!mentorId || !razorpay_order_id || !razorpay_payment_id || !amount) {
      return res.status(400).json({ success: false, message: 'Missing payment or mentor details' });
    }

    const [mentor] = await query('SELECT * FROM mentors WHERE id = ?', [mentorId]);
    if (!mentor) {
      return res.status(404).json({ success: false, message: 'Mentor not found' });
    }

    const sessionStart = new Date();
    const sessionEnd = new Date(sessionStart.getTime() + 60 * 60 * 1000);

    let bookingInsertId;
    if (existingBookingId) {
      const [existingBooking] = await query(
        'SELECT * FROM mentor_bookings WHERE id = ? AND user_id = ?',
        [existingBookingId, userId]
      );
      if (existingBooking) {
        await query(
          `UPDATE mentor_bookings
           SET razorpay_order_id = ?, razorpay_payment_id = ?, amount = ?, payment_status = 'paid',
               session_start = ?, session_end = ?, session_status = 'active', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [razorpay_order_id, razorpay_payment_id, amount, sessionStart, sessionEnd, existingBookingId]
        );
        bookingInsertId = existingBookingId;
      }
    }

    if (!bookingInsertId) {
      const result = await query(
        `INSERT INTO mentor_bookings
         (user_id, mentor_id, razorpay_order_id, razorpay_payment_id, payment_status, amount, session_start, session_end, session_status)
         VALUES (?, ?, ?, ?, 'paid', ?, ?, ?, 'active')`,
        [userId, mentorId, razorpay_order_id, razorpay_payment_id, parseFloat(amount), sessionStart, sessionEnd]
      );
      bookingInsertId = result.insertId;
    }

    // Ensure chat room exists for this booking
    const [existingRoom] = await query(
      'SELECT id FROM mentor_chat_rooms WHERE booking_id = ?',
      [bookingInsertId]
    );

    let roomId;
    if (existingRoom) {
      roomId = existingRoom.id;
    } else {
      const roomResult = await query(
        `INSERT INTO mentor_chat_rooms (uuid, booking_id, user_id, mentor_id)
         VALUES (?, ?, ?, ?)`,
        [uuidv4(), bookingInsertId, userId, mentorId]
      );
      roomId = roomResult.insertId;
    }

    // Update mentor total sessions and keep earnings consistent
    await query(
      `UPDATE mentors SET total_sessions = total_sessions + 1 WHERE id = ?`,
      [mentorId]
    );

    res.json({ success: true, bookingId: bookingInsertId, roomId });

  } catch (error) {
    console.error("Payment save error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save booking"
    });
  }
});

module.exports = router;