const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { query } = require("../db");
const { protect } = require("../middleware/auth");
const { sendEmailAsync, sendJobApplicationConfirmationEmail, sendJobApplicationAlertEmail } = require("../services/emailService");

const router = express.Router();

// --- Database Table Initialization ---
(async function initApplicationsTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id CHAR(36) PRIMARY KEY,
        job_id CHAR(36) NOT NULL,
        user_id INT NOT NULL,
        company_id CHAR(36) NOT NULL,
        status ENUM('applied','viewed','shortlisted', 'rejected') DEFAULT 'applied',
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_profile_snapshot JSON,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      )
    `);
    console.log("✅ job_applications table is ready.");
  } catch (err) {
    console.error("❌ Error initializing job_applications table:", err.message);
  }
})();

// --- Route to apply for a job (Candidate/User only) ---
router.post("/apply", protect(['user']), async (req, res) => {
    try {
        const { jobId } = req.body;
        // req.user is set by protect
        const userId = req.user.id; 
        const userEmail = req.user.email;

        if (!jobId) {
            return res.status(400).json({ success: false, message: "Job ID is required." });
        }

        const [existingApplication] = await query(
            `SELECT id FROM job_applications WHERE user_id = ? AND job_id = ?`,
            [userId, jobId]
        );
        if (existingApplication) {
            return res.status(409).json({ success: false, message: "You have already applied for this job." });
        }

        const [user] = await query('SELECT * FROM users WHERE email=?', [userEmail]);
        if (!user) {
            return res.status(404).json({ success: false, message: "Could not find your user profile to submit." });
        }
        
        const safeParse = (v) => {
          if (!v) return null;
          if (typeof v === 'object') return v;
          try { return JSON.parse(v); } catch (e) { return v; }
        };

        const professionalDetails = safeParse(user.professional_details);
        
        if (professionalDetails && professionalDetails['0'] && professionalDetails['0'].role) {
            professionalDetails.roles = professionalDetails['0'].role;
        }

        const profileSnapshot = {
          personalDetails: {
            fullName: user.full_name,
            email: user.email,
            phone: user.mobile_number,
            gender: user.gender,
            experienceLevel: user.experience_level,
            profilePhoto: user.profile_image_url || user.profile_image
          },
          professionalDetails: professionalDetails,
          projects: safeParse(user.projects),
          skills: safeParse(user.skills),
          education: safeParse(user.education),
          certifications: safeParse(user.certifications),
          languages: safeParse(user.languages),
          resumeUrl: user.resume_url,
          ctc: {
            expected: user.ctc_expected
          },
          noticePeriod: user.notice_period
        };

        const [jobData] = await query(`SELECT company_id FROM jobs WHERE id = ?`, [jobId]);
        if (!jobData) {
            return res.status(404).json({ success: false, message: "Job not found. It may have been removed." });
        }
        const companyId = jobData.company_id;

        const applicationId = uuidv4();
        await query(
            `INSERT INTO job_applications (id, job_id, user_id, company_id, user_profile_snapshot) VALUES (?, ?, ?, ?, ?)`,
            [applicationId, jobId, userId, companyId, JSON.stringify(profileSnapshot)]
        );

        // --- Fetch job and company details for email sending ---
        const [jobDetails] = await query(
            `SELECT j.job_title, j.posted_by_email, c.company_name FROM jobs j JOIN companies c ON j.company_id = c.id WHERE j.id = ?`,
            [jobId]
        );

        // --- Send application confirmation email to candidate in background ---
        sendEmailAsync(() => sendJobApplicationConfirmationEmail({
          applicationId,
          candidateName: user.full_name,
          candidateEmail: userEmail,
          jobTitle: jobDetails.job_title,
          companyName: jobDetails.company_name,
          appliedAt: new Date()
        }));

        // --- Send application alert email to employer in background ---
        sendEmailAsync(() => sendJobApplicationAlertEmail({
          applicationId,
          jobId,
          candidateName: user.full_name,
          candidateEmail: userEmail,
          candidatePhone: user.mobile_number,
          jobTitle: jobDetails.job_title,
          employerEmail: jobDetails.posted_by_email,
          appliedAt: new Date()
        }));

        res.status(201).json({ success: true, message: "Application submitted successfully!", applicationId });

    } catch (err) {
        console.error("Application submission failed:", err);
        res.status(500).json({ success: false, message: "An internal server error occurred." });
    }
});

// --- Route to get all applications for a specific job (Employer only) ---
router.get("/:jobId", protect(['company']), async (req, res) => {
    try {
        const { jobId } = req.params;
        // req.user is set by protect. We must ensure the job belongs to this company.
        const companyIdFromToken = req.user.id;

        const [job] = await query(`SELECT company_id FROM jobs WHERE id = ?`, [jobId]);

        if (!job || job.company_id !== companyIdFromToken) {
            return res.status(403).json({ success: false, message: "Forbidden: You are not authorized to view applications for this job." });
        }

        const applications = await query(
            `SELECT user_profile_snapshot FROM job_applications WHERE job_id = ?`,
            [jobId]
        );
        
        const applicants = applications
            .map(app => {
                const snapshot = app.user_profile_snapshot;
                if (typeof snapshot === 'string') {
                    try {
                        return JSON.parse(snapshot);
                    } catch (e) {
                        console.error("Failed to parse user_profile_snapshot:", snapshot, e);
                        return null; 
                    }
                }
                return snapshot; // Already an object
            })
            .filter(Boolean); 

        res.status(200).json({ success: true, applicants });

    } catch (err) {
        console.error("Failed to fetch applications:", err);
        res.status(500).json({ success: false, message: "An internal server error occurred." });
    }
});

module.exports = router;
