const jwt = require('jsonwebtoken');

/**
 * Mentor Authentication Middleware
 * Protects mentor-specific routes
 * Supports both cookie and bearer token authentication
 * Sets req.mentor with decoded mentor data
 */
const protectMentorRoute = (req, res, next) => {
  try {
    let token;

    // Check for token in cookie (website)
    if (req.cookies && req.cookies.mentorToken) {
      token = req.cookies.mentorToken;
    }
    // Check for token in Authorization header (mobile/API)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7);
    }
    // Check for token in body (legacy mobile support)
    else if (req.body && req.body.token) {
      token = req.body.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided. Please login first.',
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'mentor_jwt_secret_key'
    );

    if (!decoded || !decoded.mentorId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
      });
    }

    // Set mentor data in request
    req.mentor = {
      id: decoded.mentorId,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired. Please login again.',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token format',
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = protectMentorRoute;