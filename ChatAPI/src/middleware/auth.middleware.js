import { verifyToken } from '../utils/jwt.js';
import { AuthenticationError } from '../middleware/error.middleware.js';

// Authentication middleware
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (decoded.type !== 'access') {
      throw new AuthenticationError('Invalid token type');
    }
    
    req.userId = decoded.userId;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
        timestamp: new Date().toISOString(),
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        timestamp: new Date().toISOString(),
      });
    }
    next(error);
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      req.userId = decoded.userId;
      req.token = token;
    }
    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

// Require specific roles
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
      });
    }
    next();
  };
};

export default {
  authenticate,
  optionalAuth,
  requireRole,
};
