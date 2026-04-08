/**
 * Admin Authentication Middleware
 * Protects admin-only routes by verifying JWT token
 */

const jwt = require('jsonwebtoken');

/**
 * Middleware to protect admin routes
 * Verifies JWT token and sets req.admin with admin data
 */
const protectAdminRoute = (req, res, next) => {
    try {
        // Get token from Authorization header or cookies
        let token = req.headers.authorization?.split(' ')[1] || req.cookies?.adminToken;

        if (!token) {
            return res.status(401).json({ error: 'Admin authentication required. Please login.' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Ensure this is an admin token
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        // Attach admin data to request object
        req.admin = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Admin session expired. Please login again.' });
        }
        console.error('Admin authentication error:', err.message);
        res.status(401).json({ error: 'Invalid admin token.' });
    }
};

module.exports = { protectAdminRoute };
