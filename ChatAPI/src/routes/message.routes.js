import { Router } from 'express';
import messageController from '../controllers/message.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate, sendMessageSchema, updateMessageSchema, markReadSchema } from '../validators/message.validator.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Message routes
// IMPORTANT: /read MUST come before /:id to avoid "read" being matched as :id parameter
router.post('/read', validate(markReadSchema), messageController.markAsRead.bind(messageController));

// Specific action routes - must come before /:id to avoid conflict
router.post('/:id/recall', messageController.recallMessage.bind(messageController));
router.get('/:id/file-info', messageController.getMessageFileInfo.bind(messageController));

// Generic CRUD routes with :id parameter
router.put('/:id', validate(updateMessageSchema), messageController.editMessage.bind(messageController));
router.delete('/:id', messageController.deleteMessage.bind(messageController));

export default router;
