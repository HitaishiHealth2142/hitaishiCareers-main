# 🚀 WinJob Admin Panel - Quick Start Guide

## 5-Minute Setup

### Step 1: Create Admin Account (1 minute)
```bash
node scripts/create-admin.js
```

Follow prompts:
- Enter your email
- Enter a secure password (min 8 chars)
- Confirm password

✅ Admin account created!

### Step 2: Start Server (1 minute)
```bash
npm start
# or
node server.js
```

### Step 3: Access Admin Panel (1 minute)
Open your browser:
```
http://localhost:5000/admin
```

### Step 4: Login (1 minute)
1. Enter your email and password
2. Click "Request OTP"
3. Check your email for 6-digit code
4. Enter OTP and click "Verify"
5. ✅ You're in the dashboard!

### Step 5: Explore Dashboard (1 minute)
- 📊 View statistics
- 👥 Browse all candidates
- 🏢 Check companies
- 💼 Review job postings
- 👨‍🏫 Manage mentors (approve/reject)

---

## 🎯 What You Can Do

### View All Candidates
- Click "👥 Users" in sidebar
- See all registered job seekers
- Click card to view full profile with:
  - Contact details
  - Experience level
  - Expected salary
  - Account creation date

### Manage Companies
- Click "🏢 Companies" in sidebar
- View all employer accounts
- Click card for:
  - Company details
  - Contact information
  - Number of jobs posted
  - Website & location

### Monitor Jobs
- Click "💼 Jobs" in sidebar
- See all job postings
- Click card for:
  - Job description details
  - Required skills
  - Salary range
  - Application count

### Approve/Reject Mentors ⭐
- Click "👨‍🏫 Mentors" in sidebar
- Review mentor profiles
- Click card to expand
- See action buttons:
  - **Approve** - Verify mentor
  - **Reject** - Decline mentor
- Status updates instantly

---

## 🔑 Important Commands

### Create Admin Account
```bash
node scripts/create-admin.js
```

### Start Development Server
```bash
npm start
```

### Access Admin Dashboard
```
http://localhost:5000/admin
```

### Logout
Click "🚪 Logout" button in sidebar

---

## 📧 Email Setup

Make sure `.env` file has:
```env
ZOHO_EMAIL=your-email@winjob.in
ZOHO_PASSWORD=your-app-password
ZOHO_SMTP_HOST=smtp.zoho.in
ZOHO_SMTP_PORT=587
```

---

## 🔐 Security Notes

- ✅ Admin account only created via CLI (no web form)
- ✅ Password hashed with bcrypt
- ✅ OTP valid for only 30 seconds
- ✅ Each OTP can be used only once
- ✅ Login date/time tracked automatically
- ✅ Token expires in 7 days
- ✅ All endpoints require authentication

---

## 📱 Features Quick Reference

| Feature | Location | Time |
|---------|----------|------|
| View Stats | 📊 Dashboard | Instant |
| Browse Users | 👥 Users | Real-time |
| Check Companies | 🏢 Companies | Real-time |
| Review Jobs | 💼 Jobs | Real-time |
| Manage Mentors | 👨‍🏫 Mentors | Real-time |
| Approve Mentor | Click card → Approve | Instant |
| Reject Mentor | Click card → Reject | Instant |
| Logout | Bottom of sidebar | Instant |

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| OTP not received | Check spam folder, verify email config |
| Can't login | Ensure admin account created with create-admin.js |
| Dashboard not loading | Start server, clear browser cache |
| Mentors won't approve | Check network, ensure admin token valid |

---

## 📚 Full Documentation

For complete details, see: `ADMIN_SETUP_GUIDE.md`

---

## 🎓 Admin Features Summary

### Dashboard Statistics
- Shows 7 key metrics updated in real-time
- Pending vs Approved mentors visible
- Application count tracking

### Card-Based Interface
- Click any card to expand
- View all details in formatted layout
- Mobile responsive design
- Smooth animations

### Mentor Management
- View all mentors with status
- Approve pending mentors
- Reject unwanted profiles
- See ratings and experience instantly

### Search & Filter
- Filter candidates by name/email
- Search companies by name
- Find jobs by title
- Search mentors by name

---

## 🎉 You're All Set!

Your admin panel is ready to use. Start by:
1. Creating your admin account
2. Logging in with OTP
3. Reviewing mentor applications
4. Managing platform content

Enjoy! 🚀

---

**Last Updated:** April 2026
