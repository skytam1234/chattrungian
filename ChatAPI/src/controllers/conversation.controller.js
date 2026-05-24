import conversationService from '../services/conversation.service.js';
import socketService from '../socket/services/socket.service.js';
import { successResponse, paginatedResponse, createdResponse } from '../middleware/response.middleware.js';

export class ConversationController {
  /**
   * Get all conversations for the current user
   * GET /api/conversations
   */
  async getConversations(req, res, next) {
    try {
      const { page = 1, limit = 20, search } = req.query;
      const result = await conversationService.getConversations(req.userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        search,
      });
      return paginatedResponse(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific conversation by ID
   * GET /api/conversations/:id
   */
  async getConversationById(req, res, next) {
    try {
      const { id } = req.params;
      const conversation = await conversationService.getConversationById(id, req.userId);
      return successResponse(res, conversation);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new conversation
   * POST /api/conversations
   */
  async createConversation(req, res, next) {
    try {
      const conversation = await conversationService.createConversation(req.userId, req.body);
      // Notify other members about the new conversation
      socketService.notifyNewConversation(conversation, req.userId);
      return createdResponse(res, conversation, 'Conversation created');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a conversation
   * PUT /api/conversations/:id
   */
  async updateConversation(req, res, next) {
    try {
      const { id } = req.params;
      const conversation = await conversationService.updateConversation(id, req.userId, req.body);
      return successResponse(res, conversation, 'Conversation updated');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete or leave a conversation
   * DELETE /api/conversations/:id
   */
  async deleteConversation(req, res, next) {
    try {
      const { id } = req.params;
      const result = await conversationService.deleteConversation(id, req.userId);
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add participants to a conversation
   * POST /api/conversations/:id/participants
   */
  async addParticipants(req, res, next) {
    try {
      const { id } = req.params;
      const { userIds } = req.body;
      const result = await conversationService.addParticipants(id, req.userId, userIds);
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove a participant from a conversation
   * DELETE /api/conversations/:id/participants/:userId
   */
  async removeParticipant(req, res, next) {
    try {
      const { id, userId } = req.params;
      const result = await conversationService.removeParticipant(id, req.userId, userId);
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle pin a conversation
   * POST /api/conversations/:id/pin
   */
  async togglePin(req, res, next) {
    try {
      const { id } = req.params;
      const result = await conversationService.togglePin(id, req.userId);
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle mute a conversation
   * POST /api/conversations/:id/mute
   */
  async toggleMute(req, res, next) {
    try {
      const { id } = req.params;
      const result = await conversationService.toggleMute(id, req.userId);
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get conversation members
   * GET /api/conversations/:id/members
   */
  async getMembers(req, res, next) {
    try {
      const { id } = req.params;
      const result = await conversationService.getMembers(id, req.userId);
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Leave a conversation
   * POST /api/conversations/:id/leave
   */
  async leaveConversation(req, res, next) {
    try {
      const { id } = req.params;
      const result = await conversationService.leaveConversation(id, req.userId);
      return successResponse(res, result, 'Đã rời khỏi cuộc trò chuyện');
    } catch (error) {
      next(error);
    }
  }
}

export default new ConversationController();
