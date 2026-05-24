import { v4 as uuidv4 } from 'uuid';
import socketService from '../services/socket.service.js';
import { SOCKET_EVENTS } from '../events.js';
import prisma from '../../config/prisma.js';

export class MessageHandler {
  /**
   * Handle send message event
   */
  async handleSendMessage(socket, data) {
    try {
      const { conversationId, content, messageType = 'text', metadata, replyToId, tempId } = data;
      const userId = socket.userId;

      // Check if user is a participant
      const participant = await prisma.conversationUser.findFirst({
        where: { conversationId, userId, leftAt: null },
      });

      if (!participant) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Not a participant of this conversation' });
        return;
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          id: uuidv4(),
          conversationId,
          senderId: userId,
          content,
          messageType,
          metadata: metadata || {},
          replyToId,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Update conversation
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageId: message.id,
          lastMessageAt: message.createdAt,
        },
      });

      // Create unread entries
      const otherParticipants = await prisma.conversationUser.findMany({
        where: {
          conversationId,
          userId: { not: userId },
          leftAt: null,
        },
      });

      await prisma.$transaction(
        otherParticipants.map((p) =>
          prisma.unreadMessage.upsert({
            where: {
              userId_conversationId: {
                userId: p.userId,
                conversationId,
              },
            },
            create: {
              id: uuidv4(),
              userId: p.userId,
              conversationId,
              unreadCount: 1,
              lastUnreadAt: message.createdAt,
              hasUnreplied: false,
            },
            update: {
              unreadCount: { increment: 1 },
              lastUnreadAt: message.createdAt,
            },
          })
        )
      );

      // Create message status
      await prisma.messageStatus.create({
        data: {
          id: uuidv4(),
          messageId: message.id,
          userId,
          status: 'sent',
          deliveredAt: new Date(),
        },
      });

      // Broadcast to conversation (exclude sender since they already have the message from REST API)
      socketService.io.to(`conversation:${conversationId}`).except(`user:${userId}`).emit('new_message', {
        message: {
          ...message,
          tempId,
          status: 'sent',
        },
      });

      // Send receipt back to sender
      socket.emit('message_sent', { tempId, messageId: message.id });
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { error: 'Failed to send message' });
    }
  }

  /**
   * Handle typing start
   */
  handleTypingStart(socket, data) {
    const { conversationId, username } = data;
    socketService.notifyTyping(conversationId, socket.userId, username, true);
  }

  /**
   * Handle typing stop
   */
  handleTypingStop(socket, data) {
    const { conversationId } = data;
    socketService.notifyTyping(conversationId, socket.userId, null, false);
  }

  /**
   * Handle mark read
   */
  async handleMarkRead(socket, data) {
    try {
      const { conversationId, messageId } = data;
      const userId = socket.userId;

      // Verify user is participant
      const participant = await prisma.conversationUser.findFirst({
        where: { conversationId, userId },
      });

      if (!participant) {
        return;
      }

      // Find messages to mark
      let messagesToMark;
      if (messageId) {
        const targetMessage = await prisma.message.findUnique({ where: { id: messageId } });
        if (!targetMessage) return;

        messagesToMark = await prisma.message.findMany({
          where: {
            conversationId,
            senderId: { not: userId },
            createdAt: { lte: targetMessage.createdAt },
          },
          orderBy: { createdAt: 'asc' },
        });
      } else {
        messagesToMark = await prisma.message.findMany({
          where: {
            conversationId,
            senderId: { not: userId },
            statuses: {
              none: { userId, status: 'seen' },
            },
          },
          orderBy: { createdAt: 'asc' },
        });
      }

      if (messagesToMark.length === 0) return;

      const latestMessage = messagesToMark[messagesToMark.length - 1];

      // Update statuses
      await prisma.$transaction(
        messagesToMark.map((msg) =>
          prisma.messageStatus.upsert({
            where: {
              messageId_userId: { messageId: msg.id, userId },
            },
            create: {
              id: uuidv4(),
              messageId: msg.id,
              userId,
              status: 'seen',
              seenAt: new Date(),
              deliveredAt: new Date(),
            },
            update: {
              status: 'seen',
              seenAt: new Date(),
            },
          })
        )
      );

      // Update unread count
      await prisma.unreadMessage.upsert({
        where: {
          userId_conversationId: { userId, conversationId },
        },
        create: {
          id: uuidv4(),
          userId,
          conversationId,
          unreadCount: 0,
          lastReadMessageId: latestMessage.id,
          hasUnreplied: false,
        },
        update: {
          unreadCount: 0,
          lastReadMessageId: latestMessage.id,
          hasUnreplied: false,
          lastUnrepliedMsgId: null,
        },
      });

      // Notify sender
      messagesToMark.forEach((msg) => {
        socketService.io.to(`user:${msg.senderId}`).emit('message_status', {
          messageId: msg.id,
          userId,
          status: 'seen',
          timestamp: new Date().toISOString(),
        });
      });
    } catch (error) {
      console.error('Error marking read:', error);
    }
  }
}

export default new MessageHandler();
