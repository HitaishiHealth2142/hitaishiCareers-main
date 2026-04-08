# ✅ Admin Panel Verification Checklist

Print this page and check off each item as you complete setup.

---

## 📋 Pre-Setup Verification

### Dependencies
- [ ] `bcryptjs` installed (`npm list bcryptjs`)
- [ ] `jsonwebtoken` installed (`npm list jsonwebtoken`)
- [ ] `uuid` installed (`npm list uuid`)
- [ ] `nodemailer` installed (`npm list nodemailer`)
- [ ] All dependencies up to date (`npm install`)

### Environment Variables
- [ ] `.env` file exists in root directory
- [ ] `ZOHO_SMTP_HOST` set to `smtp.zoho.in`
- [ ] `ZOHO_SMTP_PORT` set to `587`
- [ ] `ZOHO_EMAIL` set with valid email
- [ ] `ZOHO_PASSWORD` set with app password
- [ ] `SUPPORT_EMAIL` configured
- [ ] `JWT_SECRET` set (strong random string, 32+ chars)
- [ ] `BASE_URL` set (`http://localhost:5000` or your domain)
- [ ] `NODE_ENV` set to `development` or `production`

### Database
- [ ] MySQL/MariaDB running
- [ ] Database connection working
- [ ] User has CREATE TABLE permissions

---

## 🛠️ Setup Phase

### Step 1: File Verification
- [ ] `/middleware/adminAuthMiddleware.js` exists
- [ ] `/routes/admin.js` exists
- [ ] `/scripts/create-admin.js` exists
- [ ] `/admin.html` exists
- [ ] `/utils/emailTemplates.js` updated with `getAdminOTPEmail`
- [ ] `/services/emailService.js` updated with `sendAdminOTPEmail`
- [ ] `/server.js` updated with admin routes

### Step 2: Create Admin Account
- [ ] Ran `node scripts/create-admin.js`
- [ ] Entered valid email address
- [ ] Entered password (8+ characters)
- [ ] Confirmed password matches
- [ ] Script completed successfully
- [ ] Admin ID displayed
- [ ] Email confirmed

### Step 3: Database Verification
- [ ] `admins` table created automatically
- [ ] `admin_otps` table created automatically
- [ ] Can see admin record in database
  ```sql
  SELECT * FROM admins;
  ```

### Step 4: Server Start
- [ ] Started server with `npm start`
- [ ] No startup errors in console
- [ ] Server listening on correct port (5000 or custom)
- [ ] Socket.IO running successfully
- [ ] Email service connected successfully
- [ ] All middleware loaded

---

## 🔐 Authentication Testing

### Login Flow Test
- [ ] Navigate to `http://localhost:5000/admin`
- [ ] Login page loads correctly
- [ ] Enter admin email
- [ ] Enter admin password
- [ ] Click "Request OTP"
- [ ] No errors on screen
- [ ] OTP Step appears
- [ ] Receive email with OTP within 10 seconds
- [ ] OTP is 6 digits
- [ ] Timer counts down from 30 seconds
- [ ] Enter OTP into form
- [ ] Click "Verify OTP"
- [ ] Dashboard loads successfully
- [ ] Sidebar visible with menu buttons
- [ ] Main content area showing stats

### OTP Security Test
- [ ] Request OTP again
- [ ] Try using expired OTP (after 30s) - should fail
- [ ] Request new OTP
- [ ] Use OTP twice - second attempt fails
- [ ] Error messages display correctly
- [ ] Can navigate back to credentials step

### Session Test
- [ ] Token stored in localStorage
- [ ] Close browser and reopen `/admin`
- [ ] Dashboard loads without re-login
- [ ] Can logout and login again
- [ ] Logout clears token from localStorage

---

## 📊 Dashboard Features Testing

### Statistics Section
- [ ] Navigated to "Dashboard"
- [ ] Statistics cards load
- [ ] All 7 metrics displaying
- [ ] Numbers update in real-time (if data changes)
- [ ] Mobile view working

### Users Section
- [ ] Click "👥 Users" button
- [ ] Loading spinner appears
- [ ] User cards populate
- [ ] Each card has user name and email
- [ ] Click card to expand
- [ ] Full user details displayed (phone, gender, exp level, etc.)
- [ ] Search filter works
- [ ] Multiple cards visible

### Companies Section
- [ ] Click "🏢 Companies" button
- [ ] Company cards load
- [ ] Company names and emails visible
- [ ] Click to expand for full details
- [ ] Website link clickable
- [ ] Search/filter works
- [ ] Contact info displays correctly

### Jobs Section
- [ ] Click "💼 Jobs" button
- [ ] Job cards populate
- [ ] Job titles and companies visible
- [ ] Click to expand for details
- [ ] Location info correct
- [ ] Salary range displays
- [ ] Search filter working
- [ ] Application count visible

### Mentors Section ⭐
- [ ] Click "👨‍🏫 Mentors" button
- [ ] Mentor cards load
- [ ] Status badges visible (Approved/Pending)
- [ ] Click card to expand
- [ ] Full mentor details show
- [ ] Email, title, company, experience display
- [ ] Rating and sessions show
- [ ] Hourly rate visible
- [ ] "Approve" button visible
- [ ] "Reject" button visible

---

## ✅ Mentor Management Testing

### Approve Mentor
- [ ] Find pending mentor (status: ⏳ Pending)
- [ ] Click card to expand
- [ ] Click "Approve" button
- [ ] See success alert
- [ ] Card updates to show ✓ Approved
- [ ] Mentor status changes in database

### Reject Mentor
- [ ] Find pending mentor
- [ ] Click card to expand
- [ ] Click "Reject" button
- [ ] See success alert
- [ ] Card updates to show status change
- [ ] Database updated

### Mentor Details Accuracy
- [ ] Mentor name displays correctly
- [ ] Email matches database
- [ ] Title and company accurate
- [ ] Experience years correct
- [ ] Rating matches database
- [ ] Session count correct
- [ ] Hourly rate accurate

---

## 🎯 User Interface Testing

### Responsive Design
- [ ] Works on desktop (1920x1080)
- [ ] Works on tablet (768px)
- [ ] Works on mobile (375px)
- [ ] Sidebar collapses on mobile
- [ ] Cards stack vertically on small screens
- [ ] Text readable on all sizes
- [ ] Buttons clickable on touch devices

### Navigation
- [ ] Sidebar menu buttons work
- [ ] Active button highlighted
- [ ] Section switches smoothly
- [ ] Logout button accessible
- [ ] Can login again after logout

### UI Elements
- [ ] Loading spinners appear during data fetch
- [ ] Error messages display clearly
- [ ] Buttons have hover effects
- [ ] Cards have hover animations
- [ ] Color scheme professional
- [ ] Font sizes readable

---

## 🔒 Security Testing

### Password Security
- [ ] Password hashed in database
- [ ] Password never sent in plaintext
- [ ] Minimum 8 characters enforced
- [ ] Can create new admin with different credentials

### OTP Security
- [ ] OTP never sent in GET requests
- [ ] OTP hashed in database
- [ ] OTP expires after 30 seconds
- [ ] Same OTP can't be used twice
- [ ] Each request generates new OTP

### Token Security
- [ ] JWT token in Authorization header
- [ ] HttpOnly cookie set
- [ ] Token has 7-day expiration
- [ ] Invalid token rejected
- [ ] Expired token requires re-login

### Access Control
- [ ] Only admin can access `/admin`
- [ ] Missing token gets 401 error
- [ ] Invalid token gets 401 error
- [ ] Non-admin user gets 403 error

---

## 📧 Email Testing

### OTP Email
- [ ] Email received within 10 seconds
- [ ] Email from correct sender
- [ ] Subject line correct
- [ ] OTP code visible in email
- [ ] Timer info displays (30 seconds)
- [ ] Security notice included
- [ ] Email professionally formatted
- [ ] Links work in email

---

## 🐛 Error Handling Testing

### Network Errors
- [ ] Invalid email shows error
- [ ] Wrong password shows error
- [ ] Invalid OTP shows error
- [ ] Network timeout handled gracefully

### Validation Errors
- [ ] Empty fields show error
- [ ] Invalid email format rejected
- [ ] Short password rejected
- [ ] OTP length validated

### Recovery
- [ ] Can go back from OTP step
- [ ] Can request new OTP
- [ ] Can logout and try again
- [ ] Can clear form and retry

---

## 📈 Performance Testing

### Load Time
- [ ] Admin page loads in <2 seconds
- [ ] Dashboard stats load in <1 second
- [ ] User cards load in <2 seconds
- [ ] Company cards load in <2 seconds
- [ ] Job cards load in <2 seconds
- [ ] Mentor cards load in <2 seconds

### Data Display
- [ ] 50+ cards load smoothly
- [ ] No lag on card expansion
- [ ] Search/filter responsive
- [ ] Buttons click without delay

---

## 🔗 API Endpoint Testing (Optional - Advanced)

### Authentication Endpoints
- [ ] `POST /api/admin/request-otp` - Returns 200, contains adminId
- [ ] `POST /api/admin/verify-otp` - Returns 200, contains token
- [ ] `GET /api/admin/profile` - Returns 200, requires token
- [ ] `POST /api/admin/logout` - Returns 200

### Dashboard Endpoints
- [ ] `GET /api/admin/dashboard/stats` - Returns stats object
- [ ] `GET /api/admin/dashboard/all-users` - Returns users array
- [ ] `GET /api/admin/dashboard/all-companies` - Returns companies array
- [ ] `GET /api/admin/dashboard/all-jobs` - Returns jobs array
- [ ] `GET /api/admin/dashboard/all-mentors` - Returns mentors array

### Mentor Endpoints
- [ ] `PATCH /api/admin/dashboard/mentor/:id/approve` - Updates status
- [ ] `PATCH /api/admin/dashboard/mentor/:id/reject` - Updates status

---

## 📱 Browser Compatibility (Optional)

- [ ] Chrome/Edge latest version
- [ ] Firefox latest version
- [ ] Safari latest version
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## 🎓 Documentation Check

- [ ] Read `ADMIN_SETUP_GUIDE.md`
- [ ] Read `ADMIN_QUICK_START.md`
- [ ] Understood security features
- [ ] Know how to create additional admins (if needed)
- [ ] Understand OTP process
- [ ] Know how to approve/reject mentors

---

## ⚠️ Common Issues - Checks

### If OTP not received
- [ ] `.env` email credentials correct
- [ ] Check spam folder
- [ ] Verify Zoho SMTP credentials
- [ ] Check server logs for errors
- [ ] Ensure firewall allows SMTP

### If cannot login
- [ ] Admin account created with create-admin.js
- [ ] Email address matches exactly
- [ ] Password typed correctly
- [ ] Check browser console for errors
- [ ] Verify database connection

### If dashboard won't load
- [ ] Server running (check terminal)
- [ ] Token stored in localStorage (check DevTools)
- [ ] No CORS errors (check DevTools)
- [ ] Check network tab for failed requests
- [ ] Clear browser cache and try again

### If mentors won't approve
- [ ] Ensure admin token is valid
- [ ] Check browser console for errors
- [ ] Verify database has mentors table
- [ ] Check PATCH endpoint response
- [ ] Refresh page to see updates

---

## 📝 Final Sign-Off

- [ ] **All items above checked ✓**
- [ ] **System is production-ready**
- [ ] **Admin can perform all functions**
- [ ] **Security measures verified**
- [ ] **Documentation reviewed**
- [ ] **Date Verified:** _______________
- [ ] **Verified By:** _______________

---

## 🎉 You're All Set!

Your WinJob Admin Panel is fully operational and ready for use.

**Next Steps:**
1. Create admin account for your team
2. Review mentor applications regularly
3. Monitor platform metrics
4. Manage user/company disputes as needed
5. Periodically backup database

---

**Last Updated:** April 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
