const jwt = require('jsonwebtoken');

/**
 * Common Role-Based Authentication Middleware
 * @param {Array} roles - Allowed roles (e.g., ['user', 'admin'])
 */
const protect = (roles = []) => (req, res, next) => {
    let token;

    // 1. Get token from Authorization header ONLY
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Not authorized. Token missing.' 
        });
    }

    try {
        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Role check (if roles are specified)
        // If roles is empty, any authenticated user is allowed
        if (roles.length > 0 && !roles.includes(decoded.role)) {
            return res.status(403).json({ 
                success: false, 
                message: `Forbidden: ${decoded.role} role is not authorized for this resource.` 
            });
        }

        // 4. Attach standardized user object
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error.message);
        
        let message = 'Not authorized, token failed.';
        if (error.name === 'TokenExpiredError') {
            message = 'Access token expired.';
        } else if (error.name === 'JsonWebTokenError') {
            message = 'Invalid token.';
        }

        res.status(401).json({ 
            success: false, 
            message: message 
        });
    }
};

module.exports = { protect };
