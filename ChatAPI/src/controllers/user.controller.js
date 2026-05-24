import authService from '../services/auth.service.js';
import prisma from '../config/prisma.js';
import { successResponse, errorResponse, notFoundResponse } from '../middleware/response.middleware.js';

export class UserController {
  /**
   * Get current user profile
   * GET /api/users/profile
   */
  async getProfile(req, res, next) {
    try {
      const user = await authService.getCurrentUser(req.userId);
      return successResponse(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current user profile
   * PUT /api/users/profile
   */
  async updateProfile(req, res, next) {
    try {
      const { displayName, avatarUrl, phoneNumber } = req.body;
      
      const user = await prisma.user.update({
        where: { id: req.userId },
        data: {
          displayName,
          avatarUrl,
          phoneNumber,
        },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          phoneNumber: true,
          status: true,
          isVerified: true,
          updatedAt: true,
        },
      });

      return successResponse(res, user, 'Profile updated');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user by ID
   * GET /api/users/:id
   */
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          status: true,
          lastSeenAt: true,
          isVerified: true,
        },
      });

      if (!user) {
        return notFoundResponse(res, 'User');
      }

      return successResponse(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search users
   * GET /api/users?search=term
   */
  async searchUsers(req, res, next) {
    try {
      const { search, page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = search
        ? {
            AND: [
              { id: { not: req.userId } },
              {
                OR: [
                  { username: { contains: search } },
                  { displayName: { contains: search } },
                  { email: { contains: search } },
                ],
              },
            ],
          }
        : { id: { not: req.userId } };

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
            lastSeenAt: true,
            isVerified: true,
          },
          skip,
          take: parseInt(limit),
          orderBy: { displayName: 'asc' },
        }),
        prisma.user.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
