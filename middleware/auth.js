const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify JWT_SECRET is configured
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET is not configured in environment variables');
    return res.status(500).json({ msg: 'Server configuration error' });
  }

  try {
    // Verify token with proper options
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'], // Explicitly specify allowed algorithms
      maxAge: '24h' // Token expiration check
    });

    // Validate decoded token structure
    if (!decoded || !decoded.user) {
      return res.status(401).json({ msg: 'Invalid token structure' });
    }

    // Attach user to request object
    req.user = decoded.user;
    next();
  } catch (err) {
    // Detailed error handling
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Token has expired' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ msg: 'Token is not valid' });
    } else if (err.name === 'NotBeforeError') {
      return res.status(401).json({ msg: 'Token not active yet' });
    } else {
      console.error('Auth middleware error:', err);
      return res.status(401).json({ msg: 'Authentication failed' });
    }
  }
};