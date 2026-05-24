import path from 'path';
import messageService from '../services/message.service.js';
import socketService from '../socket/services/socket.service.js';
import { successResponse, createdResponse, paginatedResponse } from '../middleware/response.middleware.js';
import { FILE_TYPES, createFileMetadataByType } from '../utils/fileHelper.js';

export class MessageController {
  /**
   * Get messages for a conversation
   * GET /api/conversations/:id/messages
   */
  async getMessages(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50, before } = req.query;

      const result = await messageService.getMessages(id, req.userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        before,
      });

      return paginatedResponse(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send a new message
   * POST /api/conversations/:id/messages
   */
  async sendMessage(req, res, next) {
    try {
      const { id } = req.params;
      console.log(`[MESSAGE] sendMessage called - conversationId: ${id}, body:`, JSON.stringify(req.body));

      const message = await messageService.sendMessage(id, req.userId, req.body);

      // Emit socket event to notify other participants
      socketService.io.to(`conversation:${id}`).except(`user:${req.userId}`).emit('new_message', {
        message: message,
      });

      return createdResponse(res, message, 'Message sent');
    } catch (error) {
      console.error(`[MESSAGE] sendMessage error:`, error.message);
      next(error);
    }
  }

  /**
   * Send a file message (image, audio, video, file)
   * POST /api/conversations/:id/messages/file
   */
  async sendFileMessage(req, res, next) {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      console.log(`[MESSAGE] sendFileMessage called - conversationId: ${id}, file:`, req.file.originalname);

      // Create file metadata
      const fileData = {
        url: `/uploads/${path.basename(req.file.destination).replace(/\\/g, '/')}/${req.file.filename}`,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      };

      // Determine message type
      let messageType = 'file';
      if (fileData.mimetype.startsWith('image/')) {
        messageType = 'image';
      } else if (fileData.mimetype.startsWith('audio/')) {
        messageType = 'audio';
      } else if (fileData.mimetype.startsWith('video/')) {
        messageType = 'video';
      }

      // Create metadata
      const metadata = createFileMetadataByType(fileData);

      // Send message with file metadata
      const message = await messageService.sendMessage(id, req.userId, {
        content: req.body.content || null,
        messageType,
        metadata,
      });

      // Emit socket event to notify other participants
      socketService.io.to(`conversation:${id}`).except(`user:${req.userId}`).emit('new_message', {
        message: message,
      });

      return createdResponse(res, message, 'File message sent');
    } catch (error) {
      console.error(`[MESSAGE] sendFileMessage error:`, error.message);
      next(error);
    }
  }

  /**
   * Edit a message
   * PUT /api/messages/:id
   */
  async editMessage(req, res, next) {
    try {
      const { id } = req.params;
      const message = await messageService.editMessage(id, req.userId, req.body);
      return successResponse(res, message, 'Message updated');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a message
   * DELETE /api/messages/:id
   */
  async deleteMessage(req, res, next) {
    try {
      const { id } = req.params;
      const result = await messageService.deleteMessage(id, req.userId);
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Recall a message
   * POST /api/messages/:id/recall
   */
  async recallMessage(req, res, next) {
    try {
      const { id } = req.params;
      console.log(`[RECALL] Attempting to recall message ${id} by user ${req.userId}`);
      
      const result = await messageService.recallMessage(id, req.userId);
      console.log(`[RECALL] Message recalled successfully, emitting to conversation ${result.conversationId}`);

      // Emit socket event to notify other participants
      socketService.io.to(`conversation:${result.conversationId}`).except(`user:${req.userId}`).emit('message_recalled', {
        messageId: id,
        conversationId: result.conversationId,
        recalledBy: req.userId,
      });
      console.log(`[RECALL] Socket event emitted to conversation:${result.conversationId}`);

      return successResponse(res, { message: 'Message recalled and deleted' });
    } catch (error) {
      console.error(`[RECALL] Error recalling message:`, error);
      next(error);
    }
  }

  /**
   * Mark messages as read
   * POST /api/messages/read
   */
  async markAsRead(req, res, next) {
    try {
      const { conversationId, messageId } = req.body;
      const result = await messageService.markAsRead(conversationId, req.userId, { messageId });
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pinned documents
   * GET /api/conversations/:id/pinned
   */
  async getPinnedDocuments(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await messageService.getPinnedDocuments(id, req.userId, {
        page: parseInt(page),
        limit: parseInt(limit),
      });

      return paginatedResponse(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Pin a message
   * POST /api/conversations/:id/pinned
   */
  async pinMessage(req, res, next) {
    try {
      const { id } = req.params;
      const result = await messageService.pinMessage(id, req.userId, req.body);
      return createdResponse(res, result, 'Message pinned');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unpin a message
   * DELETE /api/conversations/:id/pinned/:pinnedId
   */
  async unpinMessage(req, res, next) {
    try {
      const { pinnedId } = req.params;
      const result = await messageService.unpinMessage(pinnedId, req.userId);
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search messages in a conversation
   * GET /api/conversations/:id/messages/search
   */
  async searchMessages(req, res, next) {
    try {
      const { id } = req.params;
      const { q, page = 1, limit = 20 } = req.query;

      if (!q || q.trim().length === 0) {
        return successResponse(res, []);
      }

      const result = await messageService.searchMessages(id, req.userId, q.trim(), {
        page: parseInt(page),
        limit: parseInt(limit),
      });

      return paginatedResponse(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get original name from message metadata
   * GET /api/messages/:id/file-info
   */
  async getMessageFileInfo(req, res, next) {
    try {
      const { id } = req.params;
      const result = await messageService.getMessageFileOriginalName(id);
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all images in a conversation
   * GET /api/conversations/:id/images
   */
  async getConversationImages(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const result = await messageService.getConversationImages(id, req.userId, {
        page: parseInt(page),
        limit: parseInt(limit),
      });

      return paginatedResponse(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }
}

export default new MessageController();
