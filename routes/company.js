// routes/company.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const multer = require('multer');
const path = require('path');
const { query } = require("../db");
// Import unified middleware
const { protect } = require('../middleware/auth');
const { sendEmailAsync, sendCompanyRegistrationEmail, sendCompanyProfileUpdateEmail } = require('../services/emailService');


const router = express.Router();
const saltRounds = 10;
const JWT_SECRET = process.env.JWT_SECRET;

// --- Multer Configuration for Logo Uploads ---
const storage = multer.diskStorage({
    destination: './uploads/logos/',
    filename: function(req, file, cb) {
        cb(null, 'logo-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage, limits: { fileSize: 2000000 } }).single('logo');

// Initialize Company Table (no changes needed here)
(async function initCompanyTable() {
    try {
        await query(`
      CREATE TABLE IF NOT EXISTS companies (
        id CHAR(36) PRIMARY KEY, user_email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
        company_name VARCHAR(255) NOT NULL, website VARCHAR(255), description TEXT, logo_url VARCHAR(500),
        contact_person VARCHAR(255), contact_phone VARCHAR(50), address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`);
        console.log("✅ companies table is ready.");
    } catch (err) {
        console.error("❌ Error creating companies table:", err.message);
    }
})();

// POST /api/company/register (UNPROTECTED)
router.post("/register", (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        try {
            const { company_name, email, password, website, description, contact_person, contact_phone, address } = req.body;
            if (!company_name || !email || !password) return res.status(400).json({ success: false, message: "Company name, email, and password are required." });
            const existingCompany = await query('SELECT id FROM companies WHERE user_email = ?', [email]);
            if (existingCompany.length > 0) return res.status(409).json({ success: false, message: "This email address is already registered." });
            
            const id = uuidv4();
            const hashed = await bcrypt.hash(password, saltRounds);
            const logoUrl = req.file ? `/uploads/logos/${req.file.filename}` : null;
            await query(`INSERT INTO companies (id, user_email, password_hash, company_name, website, description, logo_url, contact_person, contact_phone, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, email, hashed, company_name, website, description, logoUrl, contact_person, contact_phone, address]);

            // --- Send company onboarding email in background ---
            sendEmailAsync(() => sendCompanyRegistrationEmail({
              companyName: company_name,
              email
            }));

            res.status(201).json({ success: true, message: "Registration successful!" });
        } catch (dbErr) {
            console.error("Company registration failed:", dbErr);
            res.status(500).json({ success: false, message: "An internal server error occurred." });
        }
    });
});

// POST /api/company/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [company] = await query(
      "SELECT * FROM companies WHERE user_email = ?",
      [email]
    );

    if (!company) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, company.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // ✅ JWT Token
    const token = jwt.sign(
      {
        id: company.id,
        email: company.user_email,
        role: "company"
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      company: {
        id: company.id,
        name: company.company_name,
        email: company.user_email
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// GET all companies (for public employers page) (UNPROTECTED)
router.get("/all", async (_req, res) => {
    try {
        const companies = await query(
            `SELECT id, company_name, logo_url FROM companies ORDER BY company_name ASC`
        );
        res.json({ success: true, companies });
    } catch (err) {
        console.error("Failed to fetch all companies:", err);
        res.status(500).json({ success: false, message: "Failed to fetch companies." });
    }
});


// GET /api/company/profile (PROTECTED by protect(['company']) in server.js)
// GET /api/company/profile
router.get("/profile", protect(['company']), async (req, res) => {
  try {
    const companyId = req.user.id;

    const [company] = await query(
      "SELECT * FROM companies WHERE id = ?",
      [companyId]
    );

    res.json({ success: true, company });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// PATCH /api/company/profile (PROTECTED by protect(['company']) in server.js)
// PUT /api/company/profile
router.put("/profile", protect(['company']), async (req, res) => {
  try {
    const companyId = req.user.id;

    const { company_name, website, description, contact_person, contact_phone, address } = req.body;

    await query(
      `UPDATE companies SET 
        company_name=?, website=?, description=?, 
        contact_person=?, contact_phone=?, address=? 
       WHERE id=?`,
      [company_name, website, description, contact_person, contact_phone, address, companyId]
    );

    res.json({ success: true, message: "Profile updated" });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});


module.exports = router;
