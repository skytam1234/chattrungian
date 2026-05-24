import { Router } from 'express';
import conversationController from '../controllers/conversation.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate, createConversationSchema, updateConversationSchema, addParticipantsSchema } from '../validators/message.validator.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Conversation routes
router.get('/', conversationController.getConversations.bind(conversationController));
router.get('/:id', conversationController.getConversationById.bind(conversationController));
router.post('/', validate(createConversationSchema), conversationController.createConversation.bind(conversationController));
router.put('/:id', validate(updateConversationSchema), conversationController.updateConversation.bind(conversationController));
router.delete('/:id', conversationController.deleteConversation.bind(conversationController));

// Participant management
router.post('/:id/participants', validate(addParticipantsSchema), conversationController.addParticipants.bind(conversationController));
router.delete('/:id/participants/:userId', conversationController.removeParticipant.bind(conversationController));

// Toggle pin/mute
router.post('/:id/pin', conversationController.togglePin.bind(conversationController));
router.post('/:id/mute', conversationController.toggleMute.bind(conversationController));

// Members
router.get('/:id/members', conversationController.getMembers.bind(conversationController));

// Leave conversation
router.post('/:id/leave', conversationController.leaveConversation.bind(conversationController));

export default router;
