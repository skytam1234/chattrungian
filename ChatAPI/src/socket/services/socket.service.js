import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/prisma.js';

export class SocketService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // Map<userId, Set<socketId>>
    this.socketUsers = new Map(); // Map<socketId, userId>
  }

  setIO(io) {
    this.io = io;
  }

  /**
   * Authenticate socket connection
   */
  async authenticateSocket(socket) {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    if (!token) {
      return { success: false, error: 'No token provided' };
    }

    try {
      // Verify JWT token
      const jwt = await import('jsonwebtoken');
      const config = (await import('../../config/index.js')).default;
      
      const decoded = jwt.default.verify(token, config.jwtSecret);
      
      if (decoded.type !== 'access') {
        return { success: false, error: 'Invalid token type' };
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, status: true },
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Update user status to online
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'online', lastSeenAt: new Date() },
      });

      // Track socket
      this.trackSocket(user.id, socket.id);

      return { success: true, userId: user.id };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { success: false, error: 'Token expired' };
      }
      if (error.name === 'JsonWebTokenError') {
        return { success: false, error: 'Invalid token' };
      }
      console.error('Socket auth error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Track socket for user
   */
  trackSocket(userId, socketId) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socketId);
    this.socketUsers.set(socketId, userId);
  }

  /**
   * Untrack socket
   */
  untrackSocket(socketId) {
    const userId = this.socketUsers.get(socketId);
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(socketId);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      this.socketUsers.delete(socketId);
    }
  }

  /**
   * Handle user disconnect
   * @param {string} userId - User ID
   * @param {string} socketId - Socket ID that disconnected
   */
  async handleDisconnect(userId, socketId) {
    if (!userId) return;

    // Check if user has other active sockets
    const sockets = this.userSockets.get(userId);
    const hasOtherSockets = sockets && sockets.size > 1;

    if (!hasOtherSockets) {
      // Update user status to offline
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'offline', lastSeenAt: new Date() },
      }).catch(() => {});

      // Notify other users - emit to ALL users so everyone updates
      if (this.io) {
        this.io.emit('user_offline', { userId, timestamp: new Date().toISOString() });
      }
    }
  }

  /**
   * Join a conversation room
   */
  joinConversation(socket, conversationId) {
    socket.join(`conversation:${conversationId}`);
  }

  /**
   * Leave a conversation room
   */
  leaveConversation(socket, conversationId) {
    socket.leave(`conversation:${conversationId}`);
  }

  /**
   * Send message to conversation
   */
  async sendMessageToConversation(conversationId, message, excludeUserId = null) {
    const room = `conversation:${conversationId}`;
    
    // Get all participants to notify
    const participants = await prisma.conversationUser.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    const response = {
      ...message,
      event: 'new_message',
    };

    if (this.io) {
      // Send to all in room
      if (excludeUserId) {
        // Exclude sender
        participants.forEach((p) => {
          if (p.userId !== excludeUserId) {
            this.io.to(`user:${p.userId}`).emit('new_message', response);
          }
        });
      } else {
        this.io.to(room).emit('new_message', response);
      }
    }

    return response;
  }

  /**
   * Notify typing
   */
  notifyTyping(conversationId, userId, username, isTyping) {
    if (this.io) {
      this.io.to(`conversation:${conversationId}`)
        .except(`user:${userId}`)
        .emit('user_typing', {
          conversationId,
          userId,
          username,
          isTyping,
          timestamp: new Date().toISOString(),
        });
    }
  }

  /**
   * Notify message status change
   */
  notifyMessageStatus(conversationId, messageId, userId, status) {
    if (this.io) {
      this.io.to(`conversation:${conversationId}`)
        .except(`user:${userId}`)
        .emit('message_status', {
          messageId,
          userId,
          status,
          timestamp: new Date().toISOString(),
        });
    }
  }

  /**
   * Broadcast message update (edit/delete/recall)
   */
  broadcastMessageUpdate(conversationId, messageId, action, data = {}) {
    if (this.io) {
      this.io.to(`conversation:${conversationId}`).emit('message_updated', {
        messageId,
        action, // 'edited', 'deleted', 'recalled'
        ...data,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Send notification to specific user
   */
  sendToUser(userId, event, data) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, {
        ...data,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Notify members about new conversation
   */
  notifyNewConversation(conversation, excludeUserId) {
    if (this.io) {
      // Handle both formats: raw Prisma response (with users array) and formatted response
      const memberIds = conversation.users 
        ? conversation.users.map((u) => u.userId || u.id)
        : (conversation.participants || []).map((p) => p.id);
      
      memberIds.forEach((userId) => {
        if (userId !== excludeUserId) {
          this.io.to(`user:${userId}`).emit('conversation_created', {
            conversation,
          });
        }
      });
    }
  }

  /**
   * Get online users
   */
  getOnlineUsers() {
    return Array.from(this.userSockets.keys());
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  /**
   * Get all socket IDs in a specific room (for debugging)
   */
  getSocketsInRoom(roomName) {
    if (!this.io) return [];
    const room = this.io.sockets.adapter.rooms.get(roomName);
    if (!room) return [];
    return Array.from(room);
  }
}

export default new SocketService();
