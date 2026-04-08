# 🔐 WinJob Admin Panel - Setup & Usage Guide

## Overview
A secure admin dashboard with email-based OTP authentication for managing all platform users, companies, jobs, and mentors. Admin credentials are created only via CLI for maximum security.

---

## 📑 Table of Contents
1. [Features](#features)
2. [Installation](#installation)
3. [Creating Admin Account](#creating-admin-account)
4. [Login Process](#login-process)
5. [Dashboard Features](#dashboard-features)
6. [API Endpoints](#api-endpoints)
7. [Security Features](#security-features)

---

## ✨ Features

### Authentication
- ✅ Email + Password login
- ✅ 6-digit OTP sent to email (valid for 30 seconds)
- ✅ OTP auto-expires after timeout
- ✅ Password hashing with bcrypt
- ✅ Login date/time tracking

### Dashboard
- 📊 **Dashboard Statistics** - View key metrics (users, companies, jobs, mentors, applications)
- 👥 **Candidates** - Browse all registered users with detailed profiles
- 🏢 **Companies** - Manage all employer accounts
- 💼 **Jobs** - Monitor all job postings
- 👨‍🏫 **Mentors** - Review mentor profiles and approve/reject registrations

### Mentor Management
- ✅ View all mentors with verification status
- ✅ Approve pending mentors
- ✅ Reject/Remove mentors
- ✅ View mentor statistics (ratings, sessions, experience)

### Card-Based Interface
- Click any card to expand and view full details
- Clean, responsive design
- Mobile-friendly layout

---

## 🚀 Installation

### Step 1: Ensure Dependencies
Make sure your `package.json` includes:
```json
{
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.x.x",
  "uuid": "^9.x.x",
  "crypto": "^1.0.2"
}
```

### Step 2: Files Created
The following files have been added to your project:

```
/middleware
  ├── adminAuthMiddleware.js         (Admin JWT verification)

/routes
  ├── admin.js                       (All admin API endpoints)

/scripts
  ├── create-admin.js                (CLI tool to create admin account)

/utils
  ├── emailTemplates.js              (Updated with OTP template)

/services
  ├── emailService.js                (Updated with sendAdminOTPEmail)

/
  ├── admin.html                     (Admin dashboard UI)
  ├── server.js                      (Updated with admin routes)
```

---

## 👤 Creating Admin Account

### Method 1: Using Node CLI Script (Recommended)

```bash
cd /root/hitaishiCareers-main
node scripts/create-admin.js
```

**Follow the prompts:**
```
📧 Enter Admin Email: admin@winjob.in
🔐 Enter Admin Password (min 8 chars): SecurePassword123
🔐 Confirm Password: SecurePassword123
```

**Output Example:**
```
╔════════════════════════════════════════╗
║       Admin Account Created        ║
╠════════════════════════════════════════╣
║ 📧 Email:    admin@winjob.in          ║
║ 🔑 Admin ID: a1b2c3d4-e5f6-...     ║
╠════════════════════════════════════════╣
║ 🔐 Password: ••••••••••••••••••••   ║
╚════════════════════════════════════════╝
```

### Method 2: Direct Database Insert (If needed)
```sql
INSERT INTO admins (id, email, password_hash)
VALUES ('uuid-here', 'admin@winjob.in', 'hashed-password-here');
```

---

## 🔑 Login Process

### Step 1: Navigate to Admin Panel
```
http://localhost:5000/admin
(or http://yourdomain.com/admin)
```

### Step 2: Enter Credentials
- Email: `admin@winjob.in`
- Password: Your secure password

### Step 3: Request OTP
- Click "Request OTP"
- Check your email for the 6-digit code
- **⏱️ OTP valid for 30 seconds only**

### Step 4: Verify OTP
- Enter the 6-digit code
- Click "Verify OTP"
- You'll be logged in with a 7-day session

---

## 📊 Dashboard Features

### 1. Dashboard Statistics
Shows real-time metrics:
- Total Users
- Total Companies
- Active Jobs
- Total Mentors
- Approved Mentors
- Pending Mentors
- Total Applications

### 2. Candidates Section
**View all registered job seekers**

Card shows:
- **Name** and **Email** (header)
- Full name, email, phone, gender
- Experience level
- Expected CTC
- Account creation date

Click card to expand details.

### 3. Companies Section
**Manage all employer accounts**

Card shows:
- **Company Name** and **Email** (header)
- Contact person and phone
- Website and address
- Registration date
- Jobs posted count

### 4. Jobs Section
**Monitor all job postings**

Card shows:
- **Job Title** and **Company** (header)
- Required experience
- Location (city, state, country)
- Salary range
- Current status (active/inactive)
- Posted date

### 5. Mentors Section
**Most important - Approve/Reject mentors**

Card shows:
- **Name** and **Status Badge** (Approved ✓ / Pending ⏳)
- Email, title, current company
- Years of experience
- Rating and total sessions
- Hourly rate

**Action Buttons:**
- ✅ **Approve** - Verify and approve mentor
- ❌ **Reject** - Reject mentor application

---

## 🔌 API Endpoints

All admin endpoints require `Authorization: Bearer {token}` header

### Authentication
```
POST /api/admin/request-otp
Body: { email, password }
Returns: { success, message, adminId }

POST /api/admin/verify-otp
Body: { adminId, otp }
Returns: { success, token, admin }

POST /api/admin/logout
Returns: { success, message }

GET /api/admin/profile
Returns: { success, admin }
```

### Dashboard Data
```
GET /api/admin/dashboard/stats
Returns: { success, stats }

GET /api/admin/dashboard/all-users
Returns: { success, totalCount, users }

GET /api/admin/dashboard/user/:userId
Returns: { success, user }

GET /api/admin/dashboard/all-companies
Returns: { success, totalCount, companies }

GET /api/admin/dashboard/company/:companyId
Returns: { success, company }

GET /api/admin/dashboard/all-jobs
Returns: { success, totalCount, jobs }

GET /api/admin/dashboard/job/:jobId
Returns: { success, job }

GET /api/admin/dashboard/all-mentors
Returns: { success, totalCount, mentors }

GET /api/admin/dashboard/mentor/:mentorId
Returns: { success, mentor }
```

### Mentor Management
```
PATCH /api/admin/dashboard/mentor/:mentorId/approve
Returns: { success, message, mentor }

PATCH /api/admin/dashboard/mentor/:mentorId/reject
Returns: { success, message, mentor }
```

---

## 🔒 Security Features

### Password Security
- ✅ Minimum 8 characters required
- ✅ Bcrypt hashing (10 rounds)
- ✅ Never stored in plaintext
- ✅ Only created via CLI script

### OTP Security
- ✅ 6-digit cryptographic OTP
- ✅ SHA-256 hashing in database
- ✅ 30-second expiration
- ✅ Single-use only (marked as used after verification)
- ✅ Sent via secure email

### JWT Token Security
- ✅ Signed with secret key
- ✅ 7-day expiration
- ✅ HttpOnly cookie storage
- ✅ Includes admin role verification
- ✅ All endpoints require valid token

### Admin Credentials
- ✅ Only created in console/CLI
- ✅ No public registration form
- ✅ Not exposed anywhere on website
- ✅ Login history tracked (last_login timestamp)

### Database Security
- ✅ Passwords hashed before storage
- ✅ OTP hashed before storage
- ✅ Foreign key constraints
- ✅ Automatic timestamp tracking

---

## 📧 Email Configuration

Make sure your `.env` file has:
```env
ZOHO_SMTP_HOST=smtp.zoho.in
ZOHO_SMTP_PORT=587
ZOHO_EMAIL=your-email@winjob.in
ZOHO_PASSWORD=your-app-password
SUPPORT_EMAIL=support@winjob.in
JWT_SECRET=your-secret-key-here
```

---

## 🛠️ Troubleshooting

### Issue: OTP Not Received
- ✓ Check spam folder
- ✓ Verify ZOHO_EMAIL in .env
- ✓ Check email service credentials
- ✓ Ensure 30-second window hasn't passed

### Issue: Password Reset
Use CLI script again to create new admin account with different email if needed.

### Issue: Lost Token
Clear browser cookies and login again.

### Issue: Can't Access Admin Panel
- ✓ Ensure server is running
- ✓ Verify admin account exists in database
- ✓ Check firewall/CORS settings
- ✓ Verify admin.html is deployed

---

## 📱 Access

### Development
```
http://localhost:5000/admin
```

### Production
```
https://yourdomain.com/admin
```

---

## 💾 Database Tables

### admins table
```sql
CREATE TABLE admins (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### admin_otps table
```sql
CREATE TABLE admin_otps (
  id CHAR(36) PRIMARY KEY,
  admin_id CHAR(36) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id)
)
```

---

## 🔄 Login History

Admin login date/time is automatically tracked in the `admins` table:

```sql
SELECT email, last_login FROM admins;
```

---

## 📝 Notes

1. **Admin Credentials are Secret** - Never share admin credentials. Only the person who creates it should know the password.

2. **Single Admin Support** - Currently supports single admin account. To add more admins, repeat the create-admin.js process for each email.

3. **Session Duration** - Admin token expires in 7 days. Login again after expiration.

4. **OTP Expiration** - If OTP expires, click "Go Back" and request a new OTP.

5. **Mentor Approval** - Use the Dashboard → Mentors section to review and approve/reject new mentor registrations.

---

## ✅ Verification Checklist

After setup, verify:
- [ ] Admin account created successfully
- [ ] Can access /admin page
- [ ] Email OTP sends correctly
- [ ] Token storage works (localStorage)
- [ ] Dashboard loads all sections
- [ ] Mentor cards display correctly
- [ ] Approve/Reject buttons work
- [ ] Can logout and login again
- [ ] Responsive design works on mobile

---

## 📞 Support

For issues or questions, contact: `support@winjob.in`

---

**Version:** 1.0.0  
**Last Updated:** April 2026  
**Status:** ✅ Production Ready
