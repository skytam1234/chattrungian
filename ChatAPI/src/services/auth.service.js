import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import prisma from '../config/prisma.js';
import { generateTokens, getTokenExpiration, verifyToken } from '../utils/jwt.js';
import { NotFoundError, AuthenticationError, ConflictError, ValidationError } from '../middleware/error.middleware.js';

export class AuthService {
  /**
   * Register a new user
   */
  async register({ username, email, password, displayName, phoneNumber }) {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictError('Email already registered');
      }
      throw new ConflictError('Username already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        username,
        email,
        passwordHash,
        displayName,
        phoneNumber,
        isVerified: true, // Auto-verify for development
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        isVerified: true,
        createdAt: true,
      },
    });

    return {
      user,
    };
  }

  /**
   * Login user
   */
  async login({ email, password }, deviceInfo = {}) {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Account is disabled');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Create session
    await this.createSession(user.id, tokens, deviceInfo);

    // Update user status
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'online', lastSeenAt: new Date() },
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: 'online',
        isVerified: user.isVerified,
      },
      ...tokens,
    };
  }

  /**
   * Logout user
   */
  async logout(userId, token) {
    // Find and deactivate session
    await prisma.session.updateMany({
      where: { userId, token, isActive: true },
      data: { isActive: false },
    });

    // Update user status
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'offline', lastSeenAt: new Date() },
    });

    return true;
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    // Verify refresh token
    let decoded;
    try {
      decoded = verifyToken(refreshToken);
    } catch (error) {
      throw new AuthenticationError('Invalid refresh token');
    }

    if (decoded.type !== 'refresh') {
      throw new AuthenticationError('Invalid token type');
    }

    // Find active session
    const session = await prisma.session.findFirst({
      where: {
        refreshToken,
        userId: decoded.userId,
        isActive: true,
      },
    });

    if (!session) {
      throw new AuthenticationError('Session expired or invalid');
    }

    // Check if refresh token is expired
    if (session.refreshExpiresAt && session.refreshExpiresAt < new Date()) {
      await prisma.session.update({
        where: { id: session.id },
        data: { isActive: false },
      });
      throw new AuthenticationError('Refresh token expired');
    }

    // Generate new tokens
    const tokens = generateTokens(decoded.userId);

    // Update session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: getTokenExpiration(config.jwtExpiresIn),
        refreshExpiresAt: getTokenExpiration(config.jwtRefreshExpiresIn),
      },
    });

    return tokens;
  }

  /**
   * Get current user
   */
  async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        phoneNumber: true,
        status: true,
        lastSeenAt: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  /**
   * Create session
   */
  async createSession(userId, tokens, deviceInfo = {}) {
    const expiresAt = getTokenExpiration(config.jwtExpiresIn);
    const refreshExpiresAt = getTokenExpiration(config.jwtRefreshExpiresIn);

    await prisma.session.create({
      data: {
        id: uuidv4(),
        userId,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
        refreshExpiresAt,
        deviceInfo: JSON.stringify(deviceInfo.deviceInfo || {}),
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
      },
    });
  }

  /**
   * Forgot password
   */
  async forgotPassword(email) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists
      return { message: 'If email exists, reset link has been sent' };
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiresAt: resetTokenExpires,
      },
    });

    // In production, send email here
    console.log(`Reset token for ${email}: ${resetToken}`);

    return { message: 'If email exists, reset link has been sent' };
  }

  /**
   * Reset password
   */
  async resetPassword(token, newPassword) {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new AuthenticationError('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });

    // Invalidate all sessions
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });

    return { message: 'Password reset successful' };
  }
}

export default new AuthService();
