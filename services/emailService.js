/**
 * Email Service Module
 * Handles all email sending operations using Nodemailer with Zoho SMTP
 * Production-ready with error handling and async/await support
 */

const nodemailer = require('nodemailer');
const emailTemplates = require('../utils/emailTemplates');

// ==========================================
// NODEMAILER TRANSPORTER SETUP (Zoho SMTP)
// ==========================================
const transporter = nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in',
    port: parseInt(process.env.ZOHO_SMTP_PORT || 587),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.ZOHO_EMAIL,
        pass: process.env.ZOHO_PASSWORD
    }
});

// Verify connection at startup
transporter.verify((error, success) => {
    if (error) {
        console.warn('⚠️  Email service connection warning:', error.message);
        console.warn('   Emails may not be sent until SMTP credentials are verified');
    } else {
        console.log('✅ Email service connected successfully');
    }
});

// ==========================================
// CORE EMAIL HELPER FUNCTION
// ==========================================
/**
 * Generic sendEmail function - reusable for all email types
 * @param {Object} mailOptions - {to, subject, html}
 * @returns {Promise<void>}
 */
const sendEmail = async (mailOptions) => {
    try {
        const defaultOptions = {
            from: `WinJob <${process.env.ZOHO_EMAIL}>`,
            replyTo: process.env.SUPPORT_EMAIL || process.env.ZOHO_EMAIL
        };

        const finalOptions = { ...defaultOptions, ...mailOptions };

        const info = await transporter.sendMail(finalOptions);
        console.log(`✅ Email sent successfully to ${finalOptions.to}`);
        return info;
    } catch (error) {
        console.error(`❌ Email send failed for ${mailOptions.to}:`, error.message);
        // Don't throw error - let main API continue
        return null;
    }
};

// ==========================================
// EMAIL SENDING FUNCTIONS (One per email type)
// ==========================================

/**
 * Send user registration welcome email
 * Called after successful user registration
 */
const sendUserRegistrationEmail = async (user) => {
    if (!user.email) {
        console.error('❌ sendUserRegistrationEmail: User email is required');
        return;
    }

    const mailOptions = {
        to: user.email,
        subject: 'Welcome to WinJob 🎉 - Your Account is Ready',
        html: emailTemplates.getUserRegistrationEmail(user)
    };

    return await sendEmail(mailOptions);
};

/**
 * Send user profile update confirmation email
 * Called after user profile is updated
 */
const sendUserProfileUpdateEmail = async (user) => {
    if (!user.email) {
        console.error('❌ sendUserProfileUpdateEmail: User email is required');
        return;
    }

    const mailOptions = {
        to: user.email,
        subject: 'Your WinJob Profile Was Updated ✏️',
        html: emailTemplates.getUserProfileUpdateEmail(user)
    };

    return await sendEmail(mailOptions);
};

/**
 * Send company registration welcome email
 * Called after successful company registration
 */
const sendCompanyRegistrationEmail = async (company) => {
    if (!company.email) {
        console.error('❌ sendCompanyRegistrationEmail: Company email is required');
        return;
    }

    const mailOptions = {
        to: company.email,
        subject: 'Welcome to WinJob Employer Portal 🏢',
        html: emailTemplates.getCompanyRegistrationEmail(company)
    };

    return await sendEmail(mailOptions);
};

/**
 * Send company profile update confirmation email
 * Called after company profile is updated
 */
const sendCompanyProfileUpdateEmail = async (company) => {
    if (!company.email) {
        console.error('❌ sendCompanyProfileUpdateEmail: Company email is required');
        return;
    }

    const mailOptions = {
        to: company.email,
        subject: 'Your Company Profile Was Updated on WinJob ✏️',
        html: emailTemplates.getCompanyProfileUpdateEmail(company)
    };

    return await sendEmail(mailOptions);
};

/**
 * Send job posted notification email to company
 * Called after job is successfully posted
 */
const sendJobPostedEmail = async (job) => {
    if (!job.postedByEmail) {
        console.error('❌ sendJobPostedEmail: Job posted email is required');
        return;
    }

    const mailOptions = {
        to: job.postedByEmail,
        subject: `Your Job: ${job.jobTitle} - Posted Successfully 📌`,
        html: emailTemplates.getJobPostedEmail(job)
    };

    return await sendEmail(mailOptions);
};

/**
 * Send application confirmation email to candidate
 * Called after user applies for a job
 */
const sendJobApplicationConfirmationEmail = async (application) => {
    if (!application.candidateEmail) {
        console.error('❌ sendJobApplicationConfirmationEmail: Candidate email is required');
        return;
    }

    const mailOptions = {
        to: application.candidateEmail,
        subject: `Application Submitted: ${application.jobTitle} ✅`,
        html: emailTemplates.getJobApplicationConfirmationEmail(application)
    };

    return await sendEmail(mailOptions);
};

/**
 * Send new application alert email to company/job poster
 * Called when a user applies for a job
 */
const sendJobApplicationAlertEmail = async (application) => {
    if (!application.employerEmail) {
        console.error('❌ sendJobApplicationAlertEmail: Employer email is required');
        return;
    }

    const mailOptions = {
        to: application.employerEmail,
        subject: `New Application: ${application.candidateName} applied for ${application.jobTitle} 🔔`,
        html: emailTemplates.getJobApplicationAlertEmail(application)
    };

    return await sendEmail(mailOptions);
};

/**
 * Send password change security alert email
 * Called after user changes password
 */
const sendPasswordChangeEmail = async (user, ipAddress = null) => {
    if (!user.email) {
        console.error('❌ sendPasswordChangeEmail: User email is required');
        return;
    }

    const mailOptions = {
        to: user.email,
        subject: 'Your WinJob Password Was Changed 🔐',
        html: emailTemplates.getPasswordChangeEmail(user, ipAddress)
    };

    return await sendEmail(mailOptions);
};

/**
 * Send admin OTP email for authentication
 * Called when admin requests login OTP
 */
const sendAdminOTPEmail = async (adminData) => {
    if (!adminData.email) {
        console.error('❌ sendAdminOTPEmail: Admin email is required');
        return;
    }

    const mailOptions = {
        to: adminData.email,
        subject: 'WinJob Admin Portal - One-Time Password (OTP) 🔐',
        html: emailTemplates.getAdminOTPEmail(adminData)
    };

    return await sendEmail(mailOptions);
};

// ==========================================
// BACKGROUND EMAIL SENDER (Non-blocking)
// ==========================================
/**
 * Send email in background without blocking main API response
 * Use this to wrap email sending in setTimeout
 */
const sendEmailAsync = (emailFunction) => {
    setImmediate(async () => {
        try {
            await emailFunction();
        } catch (error) {
            console.error('❌ Background email error:', error.message);
        }
    });
};

// ==========================================
// BATCH EMAIL SENDER (for multiple recipients)
// ==========================================
/**
 * Send emails to multiple recipients (mainly for admin notifications)
 * @param {Array} recipients - Array of emails
 * @param {Object} mailOptions - {subject, html}
 */
const sendBulkEmail = async (recipients, mailOptions) => {
    const promises = recipients.map(email =>
        sendEmail({
            ...mailOptions,
            to: email
        })
    );

    try {
        await Promise.all(promises);
        console.log(`✅ Bulk email sent to ${recipients.length} recipients`);
    } catch (error) {
        console.error('❌ Bulk email error:', error.message);
    }
};

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
    // Core helpers
    sendEmail,
    sendEmailAsync,
    sendBulkEmail,

    // Email type functions
    sendUserRegistrationEmail,
    sendUserProfileUpdateEmail,
    sendCompanyRegistrationEmail,
    sendCompanyProfileUpdateEmail,
    sendJobPostedEmail,
    sendJobApplicationConfirmationEmail,
    sendJobApplicationAlertEmail,
    sendPasswordChangeEmail,
    sendAdminOTPEmail,

    // Transporter for advanced usage if needed
    transporter
};
