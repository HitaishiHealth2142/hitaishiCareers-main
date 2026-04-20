/**
 * Admin Routes
 * Handles admin authentication with OTP, dashboard data, and mentor approval
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../db');
const { protect } = require('../middleware/auth');
const { sendEmailAsync, sendAdminOTPEmail } = require('../services/emailService');


const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// ==========================================
// AUTO TABLE CREATION
// ==========================================
(async function initAdminTable() {
  try {
    // Create admin table
    await query(`
      CREATE TABLE IF NOT EXISTS admins (
        id CHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create OTP table for temporary OTP storage
    await query(`
      CREATE TABLE IF NOT EXISTS admin_otps (
        id CHAR(36) PRIMARY KEY,
        admin_id CHAR(36) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
        INDEX idx_admin_id (admin_id),
        INDEX idx_expires_at (expires_at)
      )
    `);

    console.log('✅ Admin tables are ready.');
  } catch (err) {
    console.error('❌ Error initializing admin tables:', err.message);
  }
})();

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Generate a 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Hash OTP for secure storage
 */
const hashOTP = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

/**
 * Generate Admin UUID
 */
const generateAdminId = () => {
  const { v4: uuidv4 } = require('uuid');
  return uuidv4();
};

// ==========================================
// POST /api/admin/request-otp
// Request OTP after email/password verification
// ==========================================
router.post('/request-otp', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Find admin by email
    const [admin] = await query('SELECT * FROM admins WHERE email = ?', [email]);

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const otpId = generateAdminId();
    
    // OTP valid for 30 seconds
    const expiresAt = new Date(Date.now() + 30 * 1000);

    // Store OTP in database
    await query(
      `INSERT INTO admin_otps (id, admin_id, otp_hash, expires_at) VALUES (?, ?, ?, ?)`,
      [otpId, admin.id, otpHash, expiresAt]
    );

    // Send OTP email in background
    sendEmailAsync(() => sendAdminOTPEmail({
      email: admin.email,
      otp: otp,
      expiresIn: 30 // seconds
    }));

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email. Valid for 30 seconds.',
      adminId: admin.id // Send admin ID so they can verify OTP
    });

  } catch (err) {
    console.error('Error requesting OTP:', err);
    res.status(500).json({ success: false, message: 'Server error while requesting OTP.' });
  }
});

// ==========================================
// POST /api/admin/verify-otp
// Verify OTP and generate JWT token
// ==========================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { adminId, otp } = req.body;

    if (!adminId || !otp) {
      return res.status(400).json({ success: false, message: 'Admin ID and OTP are required.' });
    }

    // Get admin
    const [admin] = await query('SELECT * FROM admins WHERE id = ?', [adminId]);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    // Find valid OTP
    const otpHash = hashOTP(otp);
    const [otpRecord] = await query(
      `SELECT * FROM admin_otps 
       WHERE admin_id = ? AND otp_hash = ? AND is_used = FALSE 
       ORDER BY created_at DESC LIMIT 1`,
      [adminId, otpHash]
    );

    if (!otpRecord) {
      return res.status(401).json({ success: false, message: 'Invalid OTP.' });
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expires_at) {
      return res.status(401).json({ success: false, message: 'OTP expired. Request a new one.' });
    }

    // Mark OTP as used
    await query('UPDATE admin_otps SET is_used = TRUE WHERE id = ?', [otpRecord.id]);

    // Update last login timestamp
    await query('UPDATE admins SET last_login = NOW() WHERE id = ?', [adminId]);

    // Generate JWT token
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HttpOnly cookie
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      success: true,
      message: 'Admin authenticated successfully!',
      token: token,
      admin: {
        id: admin.id,
        email: admin.email
      }
    });

  } catch (err) {
    console.error('Error verifying OTP:', err);
    res.status(500).json({ success: false, message: 'Server error while verifying OTP.' });
  }
});

// ==========================================
// GET /api/admin/profile
// Get current admin profile (PROTECTED)
// ==========================================
router.get('/profile', protect(['admin']), async (req, res) => {
  try {
    const [admin] = await query(
      'SELECT id, email, last_login FROM admins WHERE id = ?',
      [req.user.id]
    );

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    res.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        lastLogin: admin.last_login
      }
    });
  } catch (err) {
    console.error('Error fetching admin profile:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching profile.' });
  }
});

// ==========================================
// POST /api/admin/logout
// Admin logout (PROTECTED)
// ==========================================
router.post('/logout', protect(['admin']), (req, res) => {
  res.cookie('adminToken', '', {
    httpOnly: true,
    expires: new Date(0),
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });

  res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

// ==========================================
// GET /api/admin/dashboard/all-users
// Get all users/candidates (PROTECTED)
// ==========================================
router.get('/dashboard/all-users', protect(['admin']), async (req, res) => {
  try {
    const users = await query(
      `SELECT id, full_name, email, mobile_number, gender, experience_level, 
              profile_image_url, skills, created_at FROM users ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      totalCount: users.length,
      users: users
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching users.' });
  }
});


// ==========================================
// GET /api/admin/dashboard/users/filter-by-skill/:skill
// Filter users by skill (PROTECTED)
// ==========================================
router.get('/dashboard/users/filter-by-skill/:skill', protect(['admin']), async (req, res) => {
  try {
    const { skill } = req.params;

    const users = await query(
      `SELECT id, full_name, email, mobile_number, gender,
              experience_level, profile_image_url, skills, created_at
       FROM users
       WHERE LOWER(skills) LIKE LOWER(?)
       ORDER BY created_at DESC`,
      [`%${skill}%`]
    );

    res.json({
      success: true,
      totalCount: users.length,
      users
    });
  } catch (err) {
    console.error('Error filtering users by skill:', err);
    res.status(500).json({ success: false, message: 'Server error while filtering users by skill.' });
  }
});


// ==========================================
// GET /api/admin/dashboard/user-skills
// Get all unique user skills for dropdown filter
// ==========================================
router.get('/dashboard/user-skills', protect(['admin']), async (req, res) => {
  try {
    const users = await query(`SELECT skills FROM users WHERE skills IS NOT NULL`);

    const skillsSet = new Set();

    users.forEach(user => {
      try {
        const parsedSkills =
          typeof user.skills === 'string'
            ? JSON.parse(user.skills)
            : user.skills;

        if (Array.isArray(parsedSkills)) {
          parsedSkills.forEach(skill => {
            const skillName =
              typeof skill === 'object' ? skill.name : skill;

            if (skillName) {
              skillsSet.add(skillName.trim());
            }
          });
        }
      } catch (error) {
        console.error('Skill parse error:', error);
      }
    });

    res.json({
      success: true,
      skills: Array.from(skillsSet).sort()
    });
  } catch (err) {
    console.error('Error fetching skills:', err);
    res.status(500).json({
      error: 'Server error while fetching skills'
    });
  }
});

// ==========================================
// GET /api/admin/dashboard/user/:userId
// Get detailed user profile (PROTECTED)
// ==========================================
router.get('/dashboard/user/:userId', protect(['admin']), async (req, res) => {
  try {
    const { userId } = req.params;

    const [user] = await query('SELECT * FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Parse JSON fields safely
    const safeParse = (v) => {
      if (!v) return null;
      if (typeof v === 'object') return v;
      try {
        return JSON.parse(v);
      } catch (e) {
        return null;
      }
    };

    res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        mobileNumber: user.mobile_number,
        gender: user.gender,
        experienceLevel: user.experience_level,
        profileImage: user.profile_image_url,
        ctcExpected: user.ctc_expected,
        noticePeriod: user.notice_period,
        resumeUrl: user.resume_url,
        professionalDetails: safeParse(user.professional_details),
        projects: safeParse(user.projects),
        skills: safeParse(user.skills),
        education: safeParse(user.education),
        certifications: safeParse(user.certifications),
        languages: safeParse(user.languages),
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (err) {
    console.error('Error fetching user details:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching user details.' });
  }
});

// ==========================================
// GET /api/admin/dashboard/all-companies
// Get all companies (PROTECTED)
// ==========================================
router.get('/dashboard/all-companies', protect(['admin']), async (req, res) => {
  try {
    const companies = await query(
      `SELECT id, company_name, user_email, website, logo_url, 
              contact_person, contact_phone, created_at FROM companies ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      totalCount: companies.length,
      companies: companies
    });
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching companies.' });
  }
});

// ==========================================
// GET /api/admin/dashboard/company/:companyId
// Get detailed company profile (PROTECTED)
// ==========================================
router.get('/dashboard/company/:companyId', protect(['admin']), async (req, res) => {
  try {
    const { companyId } = req.params;

    const [company] = await query(
      `SELECT id, company_name, user_email, password_hash, website, description, logo_url,
              contact_person, contact_phone, address, created_at, updated_at 
       FROM companies WHERE id = ?`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found.' });
    }

    // Get jobs posted by this company
    const jobs = await query(
      'SELECT id, job_title, status, created_at FROM jobs WHERE company_id = ? ORDER BY created_at DESC',
      [companyId]
    );

    res.json({
      success: true,
      company: {
        id: company.id,
        companyName: company.company_name,
        email: company.user_email,
        website: company.website,
        description: company.description,
        logoUrl: company.logo_url,
        contactPerson: company.contact_person,
        contactPhone: company.contact_phone,
        address: company.address,
        jobsPosted: jobs.length,
        jobs: jobs,
        createdAt: company.created_at,
        updatedAt: company.updated_at
      }
    });
  } catch (err) {
    console.error('Error fetching company details:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching company details.' });
  }
});

// ==========================================
// GET /api/admin/dashboard/all-jobs
// Get all jobs (PROTECTED)
// ==========================================
router.get('/dashboard/all-jobs', protect(['admin']), async (req, res) => {
  try {
    const jobs = await query(
      `SELECT j.id, j.job_title, j.company_id, c.company_name, j.required_experience,
              j.status, j.salary_min, j.salary_max, j.salary_currency, j.city, 
              j.state, j.country, j.created_at
       FROM jobs j
       JOIN companies c ON j.company_id = c.id
       ORDER BY j.created_at DESC`
    );

    res.json({
      success: true,
      totalCount: jobs.length,
      jobs: jobs
    });
  } catch (err) {
    console.error('Error fetching jobs:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching jobs.' });
  }
});

// ==========================================
// GET /api/admin/dashboard/job/:jobId
// Get detailed job info (PROTECTED)
// ==========================================
router.get('/dashboard/job/:jobId', protect(['admin']), async (req, res) => {
  try {
    const { jobId } = req.params;

    const [job] = await query(
      `SELECT j.*, c.company_name, c.logo_url
       FROM jobs j
       JOIN companies c ON j.company_id = c.id
       WHERE j.id = ?`,
      [jobId]
    );

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    // Get applications count
    const [appCount] = await query(
      'SELECT COUNT(*) as count FROM job_applications WHERE job_id = ?',
      [jobId]
    );

    // Parse skills
    const safeParse = (v) => {
      if (!v) return null;
      if (typeof v === 'object') return v;
      try {
        return JSON.parse(v);
      } catch (e) {
        return null;
      }
    };

    res.json({
      success: true,
      job: {
        id: job.id,
        jobTitle: job.job_title,
        companyId: job.company_id,
        companyName: job.company_name,
        companyLogo: job.logo_url,
        jobDescription: job.job_description,
        requiredExperience: job.required_experience,
        requiredSkills: safeParse(job.required_skills),
        additionalSkills: safeParse(job.additional_skills),
        status: job.status,
        salaryMin: job.salary_min,
        salaryMax: job.salary_max,
        salaryCurrency: job.salary_currency,
        salaryPeriod: job.salary_period,
        jobType: job.job_type,
        workLocation: job.work_location,
        location: {
          city: job.city,
          state: job.state,
          country: job.country,
          zipCode: job.zip_code
        },
        industry: job.industry,
        applicationsCount: appCount.count,
        createdAt: job.created_at,
        updatedAt: job.updated_at
      }
    });
  } catch (err) {
    console.error('Error fetching job details:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching job details.' });
  }
});

// ==========================================
// GET /api/admin/dashboard/all-mentors
// Get all mentors with approval status (PROTECTED)
// ==========================================
router.get('/dashboard/all-mentors', protect(['admin']), async (req, res) => {
  try {
    const mentors = await query(
      `SELECT id, full_name, email, title, current_company, experience_years,hourly_price,
              is_verified, rating, total_sessions, profile_image_url, created_at
       FROM mentors ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      totalCount: mentors.length,
      mentors: mentors
    });
  } catch (err) {
    console.error('Error fetching mentors:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching mentors.' });
  }
});

// ==========================================
// GET /api/admin/dashboard/mentor/:mentorId
// Get detailed mentor profile (PROTECTED)
// ==========================================
router.get('/dashboard/mentor/:mentorId', protect(['admin']), async (req, res) => {
  try {
    const { mentorId } = req.params;

    const [mentor] = await query(
      'SELECT * FROM mentors WHERE id = ?',
      [mentorId]
    );

    if (!mentor) {
      return res.status(404).json({ success: false, message: 'Mentor not found.' });
    }

    // Get booking statistics
    const [bookingStats] = await query(
      `SELECT COUNT(*) as totalBookings FROM mentor_bookings WHERE mentor_id = ?`,
      [mentorId]
    );

    // Parse JSON fields
    const safeParse = (v) => {
      if (!v) return null;
      if (typeof v === 'object') return v;
      try {
        return JSON.parse(v);
      } catch (e) {
        return null;
      }
    };

    res.json({
      success: true,
      mentor: {
        id: mentor.id,
        fullName: mentor.full_name,
        email: mentor.email,
        title: mentor.title,
        currentCompany: mentor.current_company,
        experienceYears: mentor.experience_years,
        expertise: safeParse(mentor.expertise),
        bio: mentor.bio,
        linkedinUrl: mentor.linkedin_url,
        profileImage: mentor.profile_image_url,
        hourlyPrice: mentor.hourly_price,
        availableSlots: safeParse(mentor.available_slots),
        rating: mentor.rating,
        totalSessions: mentor.total_sessions,
        isVerified: mentor.is_verified,
        totalBookings: bookingStats.totalBookings,
        createdAt: mentor.created_at,
        updatedAt: mentor.updated_at
      }
    });
  } catch (err) {
    console.error('Error fetching mentor details:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching mentor details.' });
  }
});

// ==========================================
// PATCH /api/admin/dashboard/mentor/:mentorId/approve
// Approve mentor (PROTECTED)
// ==========================================
router.patch('/dashboard/mentor/:mentorId/approve', protect(['admin']), async (req, res) => {
  try {
    const { mentorId } = req.params;

    const [mentor] = await query('SELECT * FROM mentors WHERE id = ?', [mentorId]);

    if (!mentor) {
      return res.status(404).json({ success: false, message: 'Mentor not found.' });
    }

    await query('UPDATE mentors SET is_verified = TRUE WHERE id = ?', [mentorId]);

    res.json({
      success: true,
      message: 'Mentor approved successfully!',
      mentor: { id: mentorId, isVerified: true }
    });
  } catch (err) {
    console.error('Error approving mentor:', err);
    res.status(500).json({ success: false, message: 'Server error while approving mentor.' });
  }
});

// ==========================================
// PATCH /api/admin/dashboard/mentor/:mentorId/reject
// Reject mentor (PROTECTED)
// ==========================================
router.patch('/dashboard/mentor/:mentorId/reject', protect(['admin']), async (req, res) => {
  try {
    const { mentorId } = req.params;

    const [mentor] = await query('SELECT * FROM mentors WHERE id = ?', [mentorId]);

    if (!mentor) {
      return res.status(404).json({ success: false, message: 'Mentor not found.' });
    }

    await query('UPDATE mentors SET is_verified = FALSE WHERE id = ?', [mentorId]);

    res.json({
      success: true,
      message: 'Mentor rejected successfully!',
      mentor: { id: mentorId, isVerified: false }
    });
  } catch (err) {
    console.error('Error rejecting mentor:', err);
    res.status(500).json({ success: false, message: 'Server error while rejecting mentor.' });
  }
});

// ==========================================
// GET /api/admin/dashboard/all-applications
// Get all job applications (PROTECTED)
// ==========================================
router.get('/dashboard/all-applications', protect(['admin']), async (req, res) => {
  try {
    const applications = await query(`
      SELECT 
        ja.id,
        ja.job_id,
        ja.user_id,
        ja.company_id,
        ja.status,
        ja.applied_at,
        ja.user_profile_snapshot,
        j.job_title,
        c.company_name
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      JOIN companies c ON ja.company_id = c.id
      ORDER BY ja.applied_at DESC
    `);

    res.json({
      success: true,
      applications: applications
    });
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching applications.' });
  }
});

// ==========================================
// GET /api/admin/dashboard/stats
// Get dashboard statistics (PROTECTED)
// ==========================================
router.get('/dashboard/stats', protect(['admin']), async (req, res) => {
  try {
    // Get counts
    const [userCount] = await query('SELECT COUNT(*) as count FROM users');
    const [companyCount] = await query('SELECT COUNT(*) as count FROM companies');
    const [jobCount] = await query('SELECT COUNT(*) as count FROM jobs WHERE status = "active"');
    const [mentorCount] = await query('SELECT COUNT(*) as count FROM mentors');
    const [verifiedMentorCount] = await query('SELECT COUNT(*) as count FROM mentors WHERE is_verified = TRUE');
    const [applicationCount] = await query('SELECT COUNT(*) as count FROM job_applications');

    res.json({
      success: true,
      stats: {
        totalUsers: userCount.count,
        totalCompanies: companyCount.count,
        activeJobs: jobCount.count,
        totalMentors: mentorCount.count,
        approvedMentors: verifiedMentorCount.count,
        pendingMentors: mentorCount.count - verifiedMentorCount.count,
        totalApplications: applicationCount.count
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching stats.' });
  }
});

module.exports = router;
