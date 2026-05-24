import { Router } from 'express';
import messageController from '../controllers/message.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate, sendMessageSchema, pinDocumentSchema } from '../validators/message.validator.js';
import { uploadSingle } from '../middleware/upload.middleware.js';
import { handleMulterError } from '../middleware/multerError.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Search messages in conversation (MUST be before /:id/messages to avoid conflict)
router.get('/:id/messages/search', messageController.searchMessages.bind(messageController));

// Conversation-specific message routes
router.get('/:id/messages', messageController.getMessages.bind(messageController));
router.post('/:id/messages', validate(sendMessageSchema), messageController.sendMessage.bind(messageController));

// Upload file and send as message (multipart/form-data)
router.post('/:id/messages/file', uploadSingle.single('file'), handleMulterError, messageController.sendFileMessage.bind(messageController));

// Pinned documents
router.get('/:id/pinned', messageController.getPinnedDocuments.bind(messageController));
router.post('/:id/pinned', validate(pinDocumentSchema), messageController.pinMessage.bind(messageController));
router.delete('/:id/pinned/:pinnedId', messageController.unpinMessage.bind(messageController));

// Images in conversation
router.get('/:id/images', messageController.getConversationImages.bind(messageController));

export default router;
