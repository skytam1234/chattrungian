import { Server } from 'socket.io';
import config from '../config/index.js';
import socketService from './services/socket.service.js';
import messageHandler from './handlers/message.handler.js';
import callHandler from './handlers/call.handler.js';
import { SOCKET_EVENTS } from './events.js';
import prisma from '../config/prisma.js';
import { cleanupUserCalls, startPeriodicCleanup, stopPeriodicCleanup } from '../services/callCleanup.service.js';

/**
 * Initialize Socket.IO server with CORS configuration
 */
export function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.socketCors.origin,
      credentials: config.socketCors.credentials,
      methods: config.socketCors.methods,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Set io in socket service
  socketService.setIO(io);

  // Authentication middleware
  io.use(async (socket, next) => {
    const result = await socketService.authenticateSocket(socket);
    
    if (!result.success) {
      return next(new Error(result.error));
    }

    socket.userId = result.userId;
    next();
  });

  // Connection handler
  io.on(SOCKET_EVENTS.CONNECT, async (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.userId})`);

    // Track user socket for presence tracking
    socketService.trackSocket(socket.userId, socket.id);

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Notify user themselves that they are online (so frontend can update)
    socket.emit('user_connected', {
      userId: socket.userId,
      isOnline: true,
      timestamp: new Date().toISOString(),
    });

    // Notify others that user is online
    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      timestamp: new Date().toISOString(),
    });

    // Join conversation rooms for user's conversations
    try {
      const conversations = await prisma.conversationUser.findMany({
        where: { userId: socket.userId, leftAt: null },
        select: { conversationId: true },
      });

      conversations.forEach((conv) => {
        socket.join(`conversation:${conv.conversationId}`);
      });
    } catch (error) {
      console.error('Error joining conversation rooms:', error);
    }

    // Handle join conversation
    socket.on(SOCKET_EVENTS.JOIN_CONVERSATION, async (data) => {
      try {
        const { conversationId } = data;
        // Verify user is participant
        const participant = await prisma.conversationUser.findFirst({
          where: { conversationId, userId: socket.userId },
        });

        if (participant) {
          socketService.joinConversation(socket, conversationId);
          socket.emit('joined_conversation', { conversationId });
        } else {
          socket.emit(SOCKET_EVENTS.ERROR, { error: 'Not a participant of this conversation' });
        }
      } catch (error) {
        console.error('Error joining conversation:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Failed to join conversation' });
      }
    });

    // Handle leave conversation
    socket.on(SOCKET_EVENTS.LEAVE_CONVERSATION, (data) => {
      const { conversationId } = data;
      socketService.leaveConversation(socket, conversationId);
      socket.emit('left_conversation', { conversationId });
    });

    // Handle send message (disabled - using REST API instead for better reliability)
    // socket.on(SOCKET_EVENTS.SEND_MESSAGE, (data) => {
    //   messageHandler.handleSendMessage(socket, data);
    // });

    // Handle typing
    socket.on(SOCKET_EVENTS.TYPING_START, (data) => {
      messageHandler.handleTypingStart(socket, data);
    });

    socket.on(SOCKET_EVENTS.TYPING_STOP, (data) => {
      messageHandler.handleTypingStop(socket, data);
    });

    // Handle mark read
    socket.on(SOCKET_EVENTS.MARK_READ, (data) => {
      messageHandler.handleMarkRead(socket, data);
    });

    // Handle disconnect
    socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
      console.log(`Socket disconnected: ${socket.id} (user: ${socket.userId})`);
      const userId = socket.userId;

      // Cleanup call state for this user (Layer 2) - pass io to notify other party
      await cleanupUserCalls(userId, io);

      // HandleDisconnect must be called BEFORE untrackSocket (it needs the userId)
      await socketService.handleDisconnect(socket.userId, socket.id);
      socketService.untrackSocket(socket.id);
    });

    // ==================== CALL EVENT HANDLERS ====================

    // Handle call initiation
    socket.on(SOCKET_EVENTS.CALL_INITIATE, (data) => {
      callHandler.handleCallInitiate(socket, data);
    });

    // Handle call acceptance
    socket.on(SOCKET_EVENTS.CALL_ACCEPT, (data) => {
      callHandler.handleCallAccept(socket, data);
    });

    // Handle call decline
    socket.on(SOCKET_EVENTS.CALL_DECLINE, (data) => {
      callHandler.handleCallDecline(socket, data);
    });

    // Handle call end
    socket.on(SOCKET_EVENTS.CALL_END, (data) => {
      callHandler.handleCallEnd(socket, data);
    });

    // Handle missed call
    socket.on(SOCKET_EVENTS.CALL_MISSED, (data) => {
      callHandler.handleCallMissed(socket, data);
    });

    // Handle WebRTC offer
    socket.on(SOCKET_EVENTS.CALL_OFFER, (data) => {
      callHandler.handleCallOffer(socket, data);
    });

    // Handle WebRTC answer
    socket.on(SOCKET_EVENTS.CALL_ANSWER, (data) => {
      callHandler.handleCallAnswer(socket, data);
    });

    // Handle ICE candidate
    socket.on(SOCKET_EVENTS.CALL_ICE_CANDIDATE, (data) => {
      callHandler.handleCallIceCandidate(socket, data);
    });
  });

  return io;
}

export default { initializeSocket };
