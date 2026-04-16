// routes/aiInterview.js
// ─────────────────────────────────────────────────────────────────────────────
// AI Interview Predictor — Backend API Routes
// Handles: resume analysis, Razorpay payment, voice interview scoring, sessions
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

require('dotenv').config();

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const { execFile } = require('child_process');
const { query } = require('../db');

const router = express.Router();

// ─────────────────────────────────────────────
// INITIALIZE DATABASE TABLE
// ─────────────────────────────────────────────
const initDB = async () => {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ai_interview_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255),
        name VARCHAR(255),
        resume_text TEXT,
        detected_role VARCHAR(100),
        plan VARCHAR(50) DEFAULT 'free',
        questions JSON,
        answers JSON,
        answer_hints JSON,
        score INT DEFAULT 0,
        transcript TEXT,
        payment_id VARCHAR(255),
        order_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    const createPaymentsTableQuery = `
      CREATE TABLE IF NOT EXISTS ai_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_name VARCHAR(255),
        user_email VARCHAR(255),
        amount DECIMAL(10, 2),
        plan_name VARCHAR(50),
        payment_status VARCHAR(50) DEFAULT 'pending',
        payment_id VARCHAR(255),
        order_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await query(createTableQuery);
    await query(createPaymentsTableQuery);
    console.log('✅ AI Interview tables checked/created');
  } catch (err) {
    console.error('❌ Database initialization error:', err);
  }
};
initDB();

// ─────────────────────────────────────────────
// DEPENDENCIES
// ─────────────────────────────────────────────
let pdfParse, mammoth, natural;
try { pdfParse = require('pdf-parse'); } catch(e) {}
try { mammoth = require('mammoth'); } catch(e) {}
try { natural = require('natural'); } catch(e) {}

const Razorpay = require('razorpay');

// Masked logging for debugging authentication issues
const key_id = process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.trim() : null;
const key_secret = process.env.RAZORPAY_KEY_SECRET ? process.env.RAZORPAY_KEY_SECRET.trim() : null;

if (!key_id || !key_secret) {
  console.warn('⚠️ Razorpay Keys missing in ENV!');
} else {
  console.log(`📡 Razorpay Initialized with ID: ${key_id}`);
}

const razorpay = new Razorpay({
  key_id: key_id,
  key_secret: key_secret,
});

// ─────────────────────────────────────────────
// MULTER CONFIG
// ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'resume' ? './uploads/resumes' : './uploads/audio';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const loadQuestions = () => {
  try {
    return JSON.parse(fs.readFileSync('./questionBank.json', 'utf8'));
  } catch (e) { return {}; }
};

const extractText = async (file) => {
  const filePath = file.path;
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf') {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text;
  } else if (ext === '.docx') {
    const data = await mammoth.extractRawText({ path: filePath });
    return data.value;
  }
  return '';
};

const detectRole = (text) => {
  const lower = text.toLowerCase();
  const scores = {
    'Fullstack': 0,
    'Data Science': 0,
    'Backend': 0
  };

  // Keyword weights
  const keywords = {
    'Fullstack': ['react', 'node', 'express', 'frontend', 'javascript', 'html', 'css', 'vue', 'angular'],
    'Data Science': ['python', 'ml', 'ai', 'data', 'machine learning', 'scikit', 'pandas', 'tensorflow', 'pytorch'],
    'Backend': ['java', 'spring', 'springboot', 'sql', 'microservices', 'hibernate', 'jpa', 'postgres', 'docker']
  };

  for (const [role, list] of Object.entries(keywords)) {
    list.forEach(kw => {
      if (lower.includes(kw)) scores[role]++;
    });
  }

  // Find role with max score, default to Fullstack
  let detected = 'Fullstack';
  let maxScore = 0;
  for (const [role, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detected = role;
    }
  }
  return detected;
};

// ─────────────────────────────────────────────
// 1) POST /resume-analyze
// ─────────────────────────────────────────────
router.post('/resume-analyze', upload.single('resume'), async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!req.file || !email) return res.status(400).json({ error: 'Resume and email required' });

    const resumeText = await extractText(req.file);
    const role = detectRole(resumeText);
    const bank = loadQuestions();
    const roleQs = bank[role] || bank['Fullstack'] || [];

    // Questions and hints logic
    const questions = roleQs.map(q => q.question);
    const hints = roleQs.map(q => q.hint);

    const result = await query(
      `INSERT INTO ai_interview_sessions 
       (email, name, resume_text, detected_role, plan, questions, answers, answer_hints) 
       VALUES (?, ?, ?, ?, 'free', ?, '[]', ?)`,
      [email, name || 'User', resumeText, role, JSON.stringify(questions), JSON.stringify(hints)]
    );

    res.json({
      success: true,
      sessionId: result.insertId,
      detectedRole: role,
      questions: questions.slice(0, 3), // Free plan default
      totalQuestions: questions.length,
      plan: 'free'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// 2) POST /create-order
// ─────────────────────────────────────────────
router.post('/create-order', async (req, res) => {
  try {
    const { amount, sessionId, email, name, planName } = req.body;
    
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const options = {
      amount: Math.round(parseFloat(amount) * 100),
      currency: "INR",
      receipt: "rcpt_" + sessionId,
    };
    const order = await razorpay.orders.create(options);

    // Record initial pending payment
    await query(
      `INSERT INTO ai_payments (user_name, user_email, amount, plan_name, order_id, payment_status) 
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [name || 'User', email, amount, planName, order.id]
    );

    res.json({ success: true, order });
  } catch (err) {
    console.error('❌ Razorpay Order Creation failed:', err);
    res.status(500).json({ 
      error: err.message || 'Payment Initialization Failed',
      details: err.error ? err.error.description : 'Authentication or Network Error'
    });
  }
});

// ─────────────────────────────────────────────
// 3) POST /verify-payment
// ─────────────────────────────────────────────
router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, sessionId, plan } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      const planName = plan == 49 ? 'starter' : plan == 99 ? 'pro' : 'ultimate';
      
      // Update session
      await query(
        `UPDATE ai_interview_sessions SET plan = ?, payment_id = ?, order_id = ? WHERE id = ?`,
        [planName, razorpay_payment_id, razorpay_order_id, sessionId]
      );

      // Update dedicated payments table
      await query(
        `UPDATE ai_payments SET payment_status = 'success', payment_id = ? WHERE order_id = ?`,
        [razorpay_payment_id, razorpay_order_id]
      );

      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// 4) POST /voice-interview
// ─────────────────────────────────────────────
router.post('/voice-interview', upload.single('audio'), async (req, res) => {
  try {
    const { sessionId, questionIndex } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Audio required' });

    const scriptPath = path.join(__dirname, '../scripts/transcribe.py');
    execFile('python', [scriptPath, req.file.path], async (error, stdout, stderr) => {
      if (error) return res.status(500).json({ error: stderr || error.message });
      
      const transcript = stdout.trim();
      
      // Better Scoring Logic
      const session = await query("SELECT * FROM ai_interview_sessions WHERE id = ?", [sessionId]);
      if (!session.length) return res.status(404).json({ error: 'Session not found' });
      
      const role = session[0].detected_role;
      const bank = loadQuestions();
      const roleData = bank[role] || bank['Fullstack'] || [];
      const currentQData = roleData[questionIndex] || {};
      const targetKeywords = currentQData.keywords || [];

      // Scoring factors
      let keywordMatches = 0;
      targetKeywords.forEach(kw => {
        if (transcript.toLowerCase().includes(kw.toLowerCase())) keywordMatches++;
      });

      const keywordScore = (keywordMatches / Math.max(1, targetKeywords.length)) * 60;
      const lengthScore = Math.min(40, (transcript.split(' ').length / 50) * 40); // Target 50+ words
      
      const totalScore = Math.round(keywordScore + lengthScore);
      const feedback = totalScore > 80 ? "Excellent response with strong technical alignment!" : 
                       totalScore > 50 ? "Good effort. Try to incorporate more specific technical keywords mentioned in the hint." : 
                       "The response was a bit brief. Try to elaborate more on your practical experience.";

      let answers = JSON.parse(session[0].answers || '[]');
      answers[questionIndex] = { transcript, score: totalScore, feedback };

      await query(
        "UPDATE ai_interview_sessions SET answers = ? WHERE id = ?", 
        [JSON.stringify(answers), sessionId]
      );

      // Average score update
      const allScores = answers.filter(a => a).map(a => a.score);
      const avgScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
      await query("UPDATE ai_interview_sessions SET score = ? WHERE id = ?", [avgScore, sessionId]);

      res.json({ success: true, transcript, score: totalScore, feedback });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// 5) GET /past-sessions
// ─────────────────────────────────────────────
router.get('/past-sessions', async (req, res) => {
  try {
    const { email } = req.query;
    const sessions = await query(
      "SELECT * FROM ai_interview_sessions WHERE email = ? ORDER BY created_at DESC", 
      [email]
    );
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// 6) GET /config/razorpay
// ─────────────────────────────────────────────
router.get('/config/razorpay', (req, res) => {
  res.json({ key: process.env.RAZORPAY_KEY_ID });
});

module.exports = router;
