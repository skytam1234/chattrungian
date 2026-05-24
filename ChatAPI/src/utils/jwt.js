import jwt from 'jsonwebtoken';
import config from '../config/index.js';

// Generate access token
export const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId, type: 'access' },
    config.jwtSecret,
    /** @type {object} */ ({ expiresIn: config.jwtExpiresIn })
  );
};

// Generate refresh token
export const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    config.jwtSecret,
    /** @type {object} */ ({ expiresIn: config.jwtRefreshExpiresIn })
  );
};

// Verify token
export const verifyToken = (token) => {
  return jwt.verify(token, config.jwtSecret);
};

// Decode token without verification
export const decodeToken = (token) => {
  return jwt.decode(token);
};

// Generate both tokens
export const generateTokens = (userId) => {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);
  
  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwtExpiresIn,
  };
};

// Calculate token expiration date
export const getTokenExpiration = (expiresIn) => {
  const unit = expiresIn.slice(-1);
  const value = parseInt(expiresIn.slice(0, -1), 10);
  
  const now = new Date();
  switch (unit) {
    case 'm': // minutes
      return new Date(now.getTime() + value * 60 * 1000);
    case 'h': // hours
      return new Date(now.getTime() + value * 60 * 60 * 1000);
    case 'd': // days
      return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 15 * 60 * 1000); // default 15 minutes
  }
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  generateTokens,
  getTokenExpiration,
};
