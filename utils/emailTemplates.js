/**
 * Email Templates Module
 * Professional, responsive HTML email templates for WinJob
 * Brand Colors: Primary Blue (#5B9BFF), Secondary Purple (#8B5CF6), White Background
 */

const BASE_URL = process.env.BASE_URL || 'https://winjob.in';
const SUPPORT_EMAIL = 'support@winjob.in';

// ==========================================
// UTILITY FUNCTION: Responsive Email Wrapper
// ==========================================
const emailWrapper = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WinJob - Career Booster</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8f9fa; color: #333; }
        .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #5B9BFF 0%, #8B5CF6 100%); padding: 30px; text-align: center; color: white; }
        .header-logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .content { padding: 40px 30px; }
        .section-title { font-size: 22px; font-weight: 600; color: #1a1a1a; margin-bottom: 15px; }
        .section-text { font-size: 14px; line-height: 1.8; color: #555; margin-bottom: 15px; }
        .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #5B9BFF 0%, #8B5CF6 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 15px 0; transition: transform 0.2s; }
        .button:hover { transform: scale(1.05); }
        .button-secondary { background: #f0f4ff; color: #5B9BFF; margin-left: 10px; }
        .button-secondary:hover { background: #e6ecff; }
        .info-box { background: #f8f9fa; padding: 20px; border-left: 4px solid #5B9BFF; border-radius: 4px; margin: 20px 0; }
        .info-box-title { font-weight: 600; color: #5B9BFF; margin-bottom: 8px; }
        .footer { background: #f8f9fa; padding: 30px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #e0e0e0; }
        .footer-links a { color: #5B9BFF; text-decoration: none; margin: 0 10px; }
        .divider { border-top: 1px solid #e0e0e0; margin: 30px 0; }
        .security-alert { background: #fff3cd; padding: 15px; border-radius: 6px; border-left: 4px solid #ff9800; margin: 20px 0; font-size: 13px; }
        .security-alert strong { color: #e67e22; }
        @media (max-width: 600px) {
            .email-container { margin: 10px; }
            .content { padding: 20px 15px; }
            .button { display: block; text-align: center; width: 100%; margin: 10px 0; }
            .button-secondary { display: block; margin-left: 0; margin-top: 10px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        ${content}
    </div>
</body>
</html>
`;

// ==========================================
// 1. USER REGISTRATION WELCOME EMAIL
// ==========================================
const getUserRegistrationEmail = (user) => {
    const content = `
        <div class="header">
            <div class="header-logo">🎉 WinJob</div>
            <p style="font-size: 14px; opacity: 0.95;">Your Career Booster Platform</p>
        </div>
        <div class="content">
            <p class="section-text">Hello <strong>${user.fullName}</strong>,</p>
            <p class="section-text">Welcome to WinJob! 🚀 Your account has been created successfully. We're excited to have you join our community of job seekers and professionals.</p>
            
            <div class="info-box">
                <div class="info-box-title">✅ Account Created Successfully</div>
                <p style="font-size: 13px; color: #555;">Your profile is ready to get discovered by top employers. Complete your profile to increase visibility and get better job recommendations.</p>
            </div>

            <p class="section-text"><strong>What's Next?</strong></p>
            <ul style="margin-left: 20px; font-size: 14px; color: #555; line-height: 2;">
                <li>Complete your professional profile</li>
                <li>Upload your resume</li>
                <li>Browse featured job opportunities</li>
                <li>Apply for jobs that match your skills</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/login.html" class="button">Login to Your Account</a>
                <a href="${BASE_URL}/userProfile.html" class="button button-secondary">Complete Your Profile</a>
            </div>

            <div class="info-box">
                <div class="info-box-title">💡 Pro Tips</div>
                <p style="font-size: 13px; color: #555;">
                    • A complete profile gets <strong>5x more visibility</strong> from employers<br>
                    • Add 5-10 relevant skills to match with job postings<br>
                    • Upload a professional resume in PDF or Word format
                </p>
            </div>

            <p class="section-text">If you have any questions, our support team is here to help! Feel free to reach out.</p>
            <p class="section-text">Happy job hunting! 🎯</p>
        </div>
        <div class="footer">
            <p>© 2026 WinJob. All rights reserved.</p>
            <p><a href="${BASE_URL}/help.html">Help Center</a> | <a href="${BASE_URL}/privacy.html">Privacy Policy</a> | <a href="${BASE_URL}/terms">Terms</a></p>
            <p style="margin-top: 15px; color: #aaa;">Questions? Contact us at ${SUPPORT_EMAIL}</p>
        </div>
    `;
    return emailWrapper(content);
};

// ==========================================
// 2. USER PROFILE UPDATE EMAIL
// ==========================================
const getUserProfileUpdateEmail = (user) => {
    const timestamp = new Date().toLocaleString('en-US', { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
    });

    const content = `
        <div class="header">
            <div class="header-logo">✏️ WinJob</div>
            <p style="font-size: 14px; opacity: 0.95;">Profile Update Notification</p>
        </div>
        <div class="content">
            <p class="section-text">Hello <strong>${user.fullName}</strong>,</p>
            <p class="section-text">Your WinJob profile has been successfully updated.</p>
            
            <div class="info-box">
                <div class="info-box-title">📝 Update Timestamp</div>
                <p style="font-size: 13px; color: #555;"><strong>${timestamp}</strong></p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/userProfile.html" class="button">View Your Profile</a>
            </div>

            <div class="security-alert">
                <strong>🔒 Security Notice:</strong> If this update wasn't made by you, please <a href="${BASE_URL}/login.html" style="color: #e67e22; font-weight: bold;">reset your password immediately</a> and contact our support team.
            </div>

            <p class="section-text"><strong>Profile changes include:</strong></p>
            <ul style="margin-left: 20px; font-size: 14px; color: #555; line-height: 1.8;">
                <li>Personal information</li>
                <li>Professional details</li>
                <li>Skills & expertise</li>
                <li>Education & certifications</li>
                <li>Portfolio & projects</li>
            </ul>
        </div>
        <div class="footer">
            <p>© 2026 WinJob. All rights reserved.</p>
            <p><a href="${BASE_URL}/help.html">Help Center</a> | <a href="${BASE_URL}/privacy.html">Privacy Policy</a> | <a href="${BASE_URL}/terms.html">Terms</a></p>
            <p style="margin-top: 15px; color: #aaa;">Questions? Contact us at ${SUPPORT_EMAIL}</p>
        </div>
    `;
    return emailWrapper(content);
};

// ==========================================
// 3. COMPANY REGISTRATION EMAIL
// ==========================================
const getCompanyRegistrationEmail = (company) => {
    const content = `
        <div class="header">
            <div class="header-logo">🏢 WinJob</div>
            <p style="font-size: 14px; opacity: 0.95;">Employer Portal</p>
        </div>
        <div class="content">
            <p class="section-text">Hello <strong>${company.companyName}</strong>,</p>
            <p class="section-text">Welcome to WinJob Employer Portal! 🎯 Your company account has been successfully created. You're now ready to post jobs and connect with top talent.</p>
            
            <div class="info-box">
                <div class="info-box-title">🎉 Account Activated</div>
                <p style="font-size: 13px; color: #555;">Start attracting qualified candidates within minutes. Our platform connects you with professionals actively seeking opportunities.</p>
            </div>

            <p class="section-text"><strong>Getting Started:</strong></p>
            <ol style="margin-left: 20px; font-size: 14px; color: #555; line-height: 2;">
                <li>Complete your company profile</li>
                <li>Upload your company logo & branding</li>
                <li>Post your first job opening</li>
                <li>Review and shortlist candidates</li>
            </ol>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/employerlogin.html" class="button">Access Employer Dashboard</a>
                <a href="${BASE_URL}/employer.html" class="button button-secondary">Post Your First Job</a>
            </div>

            <div class="info-box">
                <div class="info-box-title">💼 Benefits for Employers</div>
                <p style="font-size: 13px; color: #555;">
                    • Access to pre-qualified candidates<br>
                    • Advanced job posting features<br>
                    • Real-time application notifications<br>
                    • Candidate profiles with resumes<br>
                    • Interview scheduling tools
                </p>
            </div>

            <p class="section-text"><strong>Need help?</strong> Our dedicated support team is ready to assist you in posting your first job and managing candidates.</p>
        </div>
        <div class="footer">
            <p>© 2026 WinJob. All rights reserved.</p>
            <p><a href="${BASE_URL}/help.html">Help Center</a> | <a href="${BASE_URL}/privacy.html">Privacy Policy</a> | <a href="${BASE_URL}/terms.html">Terms</a></p>
            <p style="margin-top: 15px; color: #aaa;">Questions? Contact us at ${SUPPORT_EMAIL}</p>
        </div>
    `;
    return emailWrapper(content);
};

// ==========================================
// 4. COMPANY PROFILE UPDATE EMAIL
// ==========================================
const getCompanyProfileUpdateEmail = (company) => {
    const timestamp = new Date().toLocaleString('en-US', { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
    });

    const content = `
        <div class="header">
            <div class="header-logo">✏️ WinJob</div>
            <p style="font-size: 14px; opacity: 0.95;">Employer Portal Update</p>
        </div>
        <div class="content">
            <p class="section-text">Hello <strong>${company.companyName}</strong>,</p>
            <p class="section-text">Your company profile has been successfully updated on WinJob.</p>
            
            <div class="info-box">
                <div class="info-box-title">📝 Update Time</div>
                <p style="font-size: 13px; color: #555;"><strong>${timestamp}</strong></p>
            </div>

            <p class="section-text"><strong>Profile Updates Made:</strong></p>
            <ul style="margin-left: 20px; font-size: 14px; color: #555; line-height: 1.8;">
                <li>Company branding & logo</li>
                <li>Contact information</li>
                <li>Company description</li>
                <li>Location & address</li>
                <li>Website & social links</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/employerlogin.html" class="button">View Dashboard</a>
            </div>

            <div class="info-box">
                <div class="info-box-title">📢 Increased Visibility</div>
                <p style="font-size: 13px; color: #555;">A complete company profile increases candidate interest and application rates. Candidates can now see your brand and culture more clearly!</p>
            </div>
        </div>
        <div class="footer">
            <p>© 2026 WinJob. All rights reserved.</p>
            <p><a href="${BASE_URL}/help.html">Help Center</a> | <a href="${BASE_URL}/privacy.html">Privacy Policy</a> | <a href="${BASE_URL}/terms.html">Terms</a></p>
            <p style="margin-top: 15px; color: #aaa;">Questions? Contact us at ${SUPPORT_EMAIL}</p>
        </div>
    `;
    return emailWrapper(content);
};

// ==========================================
// 5. JOB POSTED EMAIL (to Company)
// ==========================================
const getJobPostedEmail = (job) => {
    const skillsList = Array.isArray(job.requiredSkills) 
        ? job.requiredSkills.join(', ') 
        : job.requiredSkills || 'Not specified';

    const content = `
        <div class="header">
            <div class="header-logo">📌 WinJob</div>
            <p style="font-size: 14px; opacity: 0.95;">Job Posted Successfully</p>
        </div>
        <div class="content">
            <p class="section-text">Hello <strong>${job.companyName}</strong>,</p>
            <p class="section-text">Your job posting has been published successfully! 🎉 Your opening is now live and visible to thousands of qualified candidates.</p>
            
            <div class="info-box">
                <div class="info-box-title">📋 Job Details</div>
                <div style="font-size: 13px; color: #555; line-height: 1.8;">
                    <p><strong>Job Title:</strong> ${job.jobTitle}</p>
                    <p><strong>Location:</strong> ${job.city}, ${job.state}, ${job.country}</p>
                    <p><strong>Required Skills:</strong> ${skillsList}</p>
                    ${job.salaryMin ? `<p><strong>Salary Range:</strong> ${job.salaryMin} - ${job.salaryMax} ${job.salaryCurrency}/${job.salaryPeriod}</p>` : ''}
                    <p><strong>Experience Level:</strong> ${job.requiredExperience || 'Not specified'}</p>
                </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/jobs.html/${job.jobId}" class="button">View Job Posting</a>
                <a href="${BASE_URL}/employerlogin.html/applicants/${job.jobId}" class="button button-secondary">View Applicants</a>
            </div>

            <p class="section-text"><strong>What Happens Next?</strong></p>
            <ul style="margin-left: 20px; font-size: 14px; color: #555; line-height: 2;">
                <li>Qualified candidates will start applying</li>
                <li>You'll receive application notifications</li>
                <li>Review candidate profiles and resumes</li>
                <li>Use our tools to shortlist and schedule interviews</li>
            </ul>

            <div class="info-box">
                <div class="info-box-title">💡 Tips to Attract Top Talent</div>
                <p style="font-size: 13px; color: #555;">
                    • Provide detailed job descriptions<br>
                    • Include salary range (candidates prefer transparency)<br>
                    • Highlight company benefits & culture<br>
                    • Respond to applications promptly
                </p>
            </div>
        </div>
        <div class="footer">
            <p>© 2026 WinJob. All rights reserved.</p>
            <p><a href="${BASE_URL}/help.html">Help Center</a> | <a href="${BASE_URL}/privacy.html">Privacy Policy</a> | <a href="${BASE_URL}/terms.html">Terms</a></p>
            <p style="margin-top: 15px; color: #aaa;">Questions? Contact us at ${SUPPORT_EMAIL}</p>
        </div>
    `;
    return emailWrapper(content);
};

// ==========================================
// 6. JOB APPLICATION EMAIL (to Candidate)
// ==========================================
const getJobApplicationConfirmationEmail = (application) => {
    const appliedDate = new Date(application.appliedAt).toLocaleString('en-US', { 
        dateStyle: 'medium' 
    });

    const content = `
        <div class="header">
            <div class="header-logo">✅ WinJob</div>
            <p style="font-size: 14px; opacity: 0.95;">Application Submitted</p>
        </div>
        <div class="content">
            <p class="section-text">Hello <strong>${application.candidateName}</strong>,</p>
            <p class="section-text">Congratulations! Your application has been submitted successfully. 🎊</p>
            
            <div class="info-box">
                <div class="info-box-title">📋 Application Summary</div>
                <div style="font-size: 13px; color: #555; line-height: 1.8;">
                    <p><strong>Job Title:</strong> ${application.jobTitle}</p>
                    <p><strong>Company:</strong> ${application.companyName}</p>
                    <p><strong>Applied Date:</strong> ${appliedDate}</p>
                    <p><strong>Status:</strong> <span style="background: #e3f2fd; padding: 4px 8px; border-radius: 4px; color: #1976d2;">Applied</span></p>
                </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/profile/applications" class="button">Track Application</a>
            </div>

            <p class="section-text"><strong>What Happens Now?</strong></p>
            <ul style="margin-left: 20px; font-size: 14px; color: #555; line-height: 2;">
                <li>The employer will review your application and profile</li>
                <li>Check your dashboard to track status updates</li>
                <li>You'll receive email notifications for any changes</li>
                <li>Keep applying to increase your chances!</li>
            </ul>

            <div class="info-box">
                <div class="info-box-title">💼 Application Statistics</div>
                <p style="font-size: 13px; color: #555;">
                    Candidates who apply to 3-5 jobs per week have <strong>10x higher success rates</strong> in landing interviews. Keep exploring relevant opportunities!
                </p>
            </div>

            <p class="section-text"><strong>Didn't apply for this job?</strong> Please ignore this email. Your profile was likely shared by a recruiter.</p>
        </div>
        <div class="footer">
            <p>© 2026 WinJob. All rights reserved.</p>
            <p><a href="${BASE_URL}/help.html">Help Center</a> | <a href="${BASE_URL}/privacy.html">Privacy Policy</a> | <a href="${BASE_URL}/terms.html">Terms</a></p>
            <p style="margin-top: 15px; color: #aaa;">Questions? Contact us at ${SUPPORT_EMAIL}</p>
        </div>
    `;
    return emailWrapper(content);
};

// ==========================================
// 7. JOB APPLICATION ALERT EMAIL (to Company)
// ==========================================
const getJobApplicationAlertEmail = (application) => {
    const appliedDate = new Date(application.appliedAt).toLocaleString('en-US', { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
    });

    const content = `
        <div class="header">
            <div class="header-logo">🔔 WinJob</div>
            <p style="font-size: 14px; opacity: 0.95;">New Candidate Applied</p>
        </div>
        <div class="content">
            <p class="section-text">Great news! A new candidate has applied for your job posting. 🎯</p>
            
            <div class="info-box">
                <div class="info-box-title">📌 Job Position</div>
                <p style="font-size: 13px; color: #555;"><strong>${application.jobTitle}</strong></p>
            </div>

            <div class="info-box">
                <div class="info-box-title">👤 Candidate Information</div>
                <div style="font-size: 13px; color: #555; line-height: 1.8;">
                    <p><strong>Name:</strong> ${application.candidateName}</p>
                    <p><strong>Email:</strong> ${application.candidateEmail}</p>
                    <p><strong>Phone:</strong> ${application.candidatePhone || 'Not provided'}</p>
                    <p><strong>Applied:</strong> ${appliedDate}</p>
                </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/employerlogin/applicants/${application.jobId}/${application.applicationId}" class="button">View Applicant Profile</a>
                <a href="${BASE_URL}/employerlogin/resume/${application.applicationId}" class="button button-secondary">View Resume</a>
            </div>

            <p class="section-text"><strong>Quick Actions:</strong></p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin: 15px 0;">
                <a href="${BASE_URL}/employerlogin/shortlist/${application.applicationId}" style="flex: 1; min-width: 140px; padding: 10px; background: #4caf50; color: white; text-decoration: none; border-radius: 6px; text-align: center; font-size: 13px; font-weight: 600;">⭐ Shortlist Candidate</a>
                <a href="${BASE_URL}/employerlogin/reject/${application.applicationId}" style="flex: 1; min-width: 140px; padding: 10px; background: #f44336; color: white; text-decoration: none; border-radius: 6px; text-align: center; font-size: 13px; font-weight: 600;">✕ Reject</a>
            </div>

            <div class="info-box">
                <div class="info-box-title">📊 Application Details</div>
                <p style="font-size: 13px; color: #555;">All candidate information including experience, skills, education, and resume are available in your applicant dashboard. Review and take action to move qualified candidates forward in your hiring process.</p>
            </div>
        </div>
        <div class="footer">
            <p>© 2026 WinJob. All rights reserved.</p>
            <p><a href="${BASE_URL}/help.html">Help Center</a> | <a href="${BASE_URL}/privacy.html">Privacy Policy</a> | <a href="${BASE_URL}/terms.html">Terms</a></p>
            <p style="margin-top: 15px; color: #aaa;">Questions? Contact us at ${SUPPORT_EMAIL}</p>
        </div>
    `;
    return emailWrapper(content);
};

// ==========================================
// 8. PASSWORD CHANGE EMAIL (Security Alert)
// ==========================================
const getPasswordChangeEmail = (user, ipAddress = 'IP address unavailable') => {
    const timestamp = new Date().toLocaleString('en-US', { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
    });

    const content = `
        <div class="header">
            <div class="header-logo">🔐 WinJob</div>
            <p style="font-size: 14px; opacity: 0.95;">Security Alert</p>
        </div>
        <div class="content">
            <p class="section-text">Hello <strong>${user.fullName}</strong>,</p>
            <p class="section-text">We noticed that your WinJob password was recently changed. If this was you, you can safely ignore this email.</p>
            
            <div class="security-alert">
                <strong>🚨 Suspicious Activity?</strong> If you didn't change your password, someone may have accessed your account. Take immediate action by resetting your password.
            </div>

            <div class="info-box">
                <div class="info-box-title">🕐 Change Details</div>
                <div style="font-size: 13px; color: #555; line-height: 1.8;">
                    <p><strong>Timestamp:</strong> ${timestamp}</p>
                    <p><strong>IP Address:</strong> ${ipAddress}</p>
                    <p><strong>Email:</strong> ${user.email}</p>
                </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/profile/security" class="button">Manage Security Settings</a>
                <a href="${BASE_URL}/reset-password" class="button button-secondary">Reset Password</a>
            </div>

            <p class="section-text"><strong>Security Tips:</strong></p>
            <ul style="margin-left: 20px; font-size: 14px; color: #555; line-height: 2;">
                <li>Use a strong, unique password (8+ characters with uppercase, numbers, symbols)</li>
                <li>Never share your password or reset link with anyone</li>
                <li>Enable two-factor authentication for extra security</li>
                <li>Regularly review your account activity</li>
                <li>Log out from other devices if needed</li>
            </ul>

            <div class="security-alert">
                <strong>⚠️ Need Help?</strong> If you believe your account has been compromised, please contact our security team immediately at ${SUPPORT_EMAIL}
            </div>
        </div>
        <div class="footer">
            <p>© 2026 WinJob. All rights reserved.</p>
            <p><a href="${BASE_URL}/help.html">Help Center</a> | <a href="${BASE_URL}/privacy.html">Privacy Policy</a> | <a href="${BASE_URL}/terms.html">Terms</a></p>
            <p style="margin-top: 15px; color: #aaa;">This is a security notification email. Do not reply to this email.</p>
        </div>
    `;
    return emailWrapper(content);
};

// ==========================================
// 10. PASSWORD RESET OTP EMAIL
// ==========================================
const getPasswordResetOTPEmail = (data) => {
    const content = `
        <div class="header">
            <div class="header-logo">🔐 WinJob</div>
            <p style="font-size: 14px; opacity: 0.95;">Password Reset - One-Time Password</p>
        </div>
        <div class="content">
            <p class="section-text">Hello,</p>
            <p class="section-text">We received a request to reset your WinJob account password. Use the One-Time Password (OTP) below to proceed with the reset.</p>
            
            <div class="info-box">
                <div class="info-box-title">🔑 Your Reset OTP</div>
                <div style="background: #f0f4ff; padding: 20px; border-radius: 8px; text-align: center; margin: 15px 0;">
                    <p style="font-size: 14px; color: #555; margin-bottom: 10px; letter-spacing: 2px;">
                        <span style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; color: #5B9BFF; letter-spacing: 4px;">
                            ${data.otp}
                        </span>
                    </p>
                    <p style="font-size: 12px; color: #e67e22; margin: 0;">
                        ⏱️ Valid for <strong>10 minutes</strong>
                    </p>
                </div>
            </div>

            <div class="security-alert">
                <strong>⚠️ Security Warning:</strong>
                <ul style="margin-left: 10px; font-size: 13px; color: #333;">
                    <li>Never share this OTP with anyone.</li>
                    <li>If you didn't request a password reset, please ignore this email or change your password if you're concerned about your account security.</li>
                </ul>
            </div>

            <p class="section-text">After entering the OTP, you will be able to create a new password for your account.</p>
        </div>
        <div class="footer">
            <p>© 2026 WinJob. All rights reserved.</p>
            <p><a href="${BASE_URL}/help.html">Help Center</a> | <a href="${BASE_URL}/privacy.html">Privacy Policy</a></p>
            <p style="margin-top: 15px; color: #aaa;">This is an automated security email. Do not reply.</p>
        </div>
    `;
    return emailWrapper(content);
};

// ==========================================
// 9. ADMIN OTP EMAIL
// ==========================================
const getAdminOTPEmail = (data) => {
    const content = `
        <div class="header">
            <div class="header-logo">🔐 WinJob</div>
            <p style="font-size: 14px; opacity: 0.95;">Admin Portal - One-Time Password</p>
        </div>
        <div class="content">
            <p class="section-text">Hello Admin,</p>
            <p class="section-text">Your One-Time Password (OTP) for WinJob Admin Portal has been generated. This code is required to complete your login.</p>
            
            <div class="info-box">
                <div class="info-box-title">🔑 Your OTP Code</div>
                <div style="background: #f0f4ff; padding: 20px; border-radius: 8px; text-align: center; margin: 15px 0;">
                    <p style="font-size: 14px; color: #555; margin-bottom: 10px; letter-spacing: 2px;">
                        <span style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; color: #5B9BFF; letter-spacing: 4px;">
                            ${data.otp}
                        </span>
                    </p>
                    <p style="font-size: 12px; color: #e67e22; margin: 0;">
                        ⏱️ Valid for only <strong>${data.expiresIn} seconds</strong>
                    </p>
                </div>
            </div>

            <div class="security-alert">
                <strong>⚠️ Important Security Notice:</strong>
                <ul style="margin-left: 10px; font-size: 13px; color: #333;">
                    <li>Never share this OTP with anyone</li>
                    <li>WinJob staff will never ask for your OTP</li>
                    <li>This code expires in ${data.expiresIn} seconds</li>
                    <li>If you didn't request this OTP, ignore this email</li>
                </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <p style="font-size: 13px; color: #666; margin-bottom: 15px;">Return to your login and enter the OTP above to proceed.</p>
            </div>

            <div class="info-box">
                <div class="info-box-title">🛡️ Admin Security</div>
                <p style="font-size: 13px; color: #555;">
                    Your admin account is protected by advanced security measures including:
                    <ul style="margin-left: 15px; margin-top: 8px;">
                        <li>Two-factor authentication (OTP)</li>
                        <li>Login date/time tracking</li>
                        <li>Encrypted password storage</li>
                        <li>Session management</li>
                    </ul>
                </p>
            </div>

            <p class="section-text"><strong>Did Not Request This?</strong> If you did not attempt to login to the admin portal, please contact the security team immediately at ${SUPPORT_EMAIL}</p>
        </div>
        <div class="footer">
            <p>© 2026 WinJob. All rights reserved.</p>
            <p>This is an automated security email. Do not reply - contact ${SUPPORT_EMAIL} for assistance.</p>
            <p style="margin-top: 15px; color: #aaa;">This email was sent to ensure the security of your admin account.</p>
        </div>
    `;
    return emailWrapper(content);
};

module.exports = {
    getUserRegistrationEmail,
    getUserProfileUpdateEmail,
    getCompanyRegistrationEmail,
    getCompanyProfileUpdateEmail,
    getJobPostedEmail,
    getJobApplicationConfirmationEmail,
    getJobApplicationAlertEmail,
    getPasswordChangeEmail,
    getAdminOTPEmail,
    getPasswordResetOTPEmail
};
