import { Router } from 'express';
import userController from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import prisma from '../config/prisma.js';

const router = Router();

// DEBUG: Clear call occupation for a user (for testing) - MUST be before authenticate middleware
router.post('/debug/clear-call-occupation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await prisma.user.update({
      where: { id: userId },
      data: { callOccupiedUntil: null },
    });
    
    // Also end any active calls for this user
    await prisma.call.updateMany({
      where: {
        OR: [
          { callerId: userId, status: { in: ['pending', 'ringing', 'accepted'] } },
          { calleeId: userId, status: { in: ['pending', 'ringing', 'accepted'] } },
        ],
      },
      data: {
        status: 'ended',
        endedAt: new Date(),
      },
    });
    
    res.json({ success: true, message: 'Call occupation cleared' });
  } catch (error) {
    console.error('Error clearing call occupation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// All other routes require authentication
router.use(authenticate);

// Get user profile
router.get('/profile', userController.getProfile.bind(userController));

// Update user profile
router.put('/profile', userController.updateProfile.bind(userController));

// Get user by ID
router.get('/:id', userController.getUserById.bind(userController));

// Search users
router.get('/', userController.searchUsers.bind(userController));

export default router;
