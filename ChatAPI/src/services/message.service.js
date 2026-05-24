import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, AuthorizationError, ValidationError } from '../middleware/error.middleware.js';
import prisma from '../config/prisma.js';

export class MessageService {
  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId, userId, { page = 1, limit = 50, before } = {}) {
    // Check if user is a participant
    const participant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      throw new NotFoundError('Conversation');
    }

    const skip = (page - 1) * limit;

    const where = {
      conversationId,
      isRecalled: false,
      ...(before && { createdAt: { lt: new Date(before) } }),
    };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              status: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              senderId: true,
              messageType: true,
              sender: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
          statuses: {
            where: { userId },
            select: {
              status: true,
              seenAt: true,
              deliveredAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    // Transform messages - add isDeletedForUser flag
    const transformedMessages = messages.map((msg) => ({
      id: msg.id,
      content: msg.isRecalled ? null : msg.content,
      messageType: msg.messageType,
      metadata: msg.metadata,
      isEdited: msg.isEdited,
      isRecalled: msg.isRecalled,
      isDeleted: (msg.deletedBy || []).includes(userId), // True if current user deleted this message
      replyTo: msg.replyTo ? {
        id: msg.replyTo.id,
        content: msg.replyTo.content,
        senderId: msg.replyTo.senderId,
        messageType: msg.replyTo.messageType,
        senderName: msg.replyTo.sender?.displayName,
      } : null,
      sender: msg.sender,
      status: msg.statuses[0]?.status || 'sent',
      seenAt: msg.statuses[0]?.seenAt,
      deliveredAt: msg.statuses[0]?.deliveredAt,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));

    return {
      data: transformedMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total,
      },
    };
  }

  /**
   * Send a new message
   */
  async sendMessage(conversationId, senderId, { content, messageType = 'text', metadata, replyToId, tempId }) {
    // Check if user is a participant
    const participant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId: senderId, leftAt: null },
    });

    if (!participant) {
      throw new NotFoundError('Conversation');
    }

    // Validate reply message if provided
    if (replyToId) {
      const replyMessage = await prisma.message.findFirst({
        where: { id: replyToId, conversationId, isRecalled: false },
      });

      if (!replyMessage) {
        throw new ValidationError('Reply message not found');
      }
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        id: uuidv4(),
        conversationId,
        senderId,
        content,
        messageType,
        metadata: metadata || {},
        replyToId,
        deletedBy: [],
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
        replyTo: {
          select: {
            id: true,
            content: true,
            senderId: true,
            messageType: true,
            sender: {
              select: {
                id: true,
                displayName: true,
              },
            },
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

    // Create unread entries for other participants
    const otherParticipants = await prisma.conversationUser.findMany({
      where: {
        conversationId,
        userId: { not: senderId },
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

    // Create message status for sender
    await prisma.messageStatus.create({
      data: {
        id: uuidv4(),
        messageId: message.id,
        userId: senderId,
        status: 'sent',
        deliveredAt: new Date(),
      },
    });

    return {
      ...message,
      tempId,
      status: 'sent',
    };
  }

  /**
   * Edit a message
   */
  async editMessage(messageId, userId, { content }) {
    const message = await prisma.message.findFirst({
      where: { id: messageId, senderId: userId, isRecalled: false },
    });

    if (!message) {
      throw new NotFoundError('Message');
    }

    // Can only edit text messages
    if (message.messageType !== 'text') {
      throw new ValidationError('Only text messages can be edited');
    }

    // Can only edit within 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (message.createdAt < fifteenMinutesAgo) {
      throw new ValidationError('Messages can only be edited within 15 minutes');
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { content, isEdited: true },
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

    return updatedMessage;
  }

  /**
   * Delete a message (soft delete per user)
   * Only the sender can delete, and it only hides from the deleter's view
   */
  async deleteMessage(messageId, userId) {
    const message = await prisma.message.findFirst({
      where: { id: messageId, senderId: userId, isRecalled: false },
    });

    if (!message) {
      throw new NotFoundError('Message');
    }

    // Track which users have deleted this message
    const deletedBy = message.deletedBy || [];
    if (!deletedBy.includes(userId)) {
      deletedBy.push(userId);
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { deletedBy },
    });

    return { message: 'Message deleted for you' };
  }

  /**
   * Recall a message (within 24 hours)
   * Only the sender can recall, and it permanently deletes the message
   */
  async recallMessage(messageId, userId) {
    const message = await prisma.message.findFirst({
      where: { id: messageId, senderId: userId, isRecalled: false },
    });

    if (!message) {
      throw new NotFoundError('Message');
    }

    // Can only recall within 24 hours from creation or last update
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const effectiveDate = message.updatedAt > message.createdAt ? message.updatedAt : message.createdAt;
    
    if (effectiveDate < twentyFourHoursAgo) {
      throw new ValidationError('Messages can only be recalled within 24 hours');
    }

    // Get conversation info before deleting
    const conversationId = message.conversationId;
    const senderId = message.senderId;

    // Hard delete the message
    await prisma.message.delete({
      where: { id: messageId },
    });

    // Also update unread counts
    await prisma.unreadMessage.updateMany({
      where: {
        conversationId: message.conversationId,
        lastUnrepliedMsgId: messageId,
      },
      data: {
        hasUnreplied: false,
        lastUnrepliedMsgId: null,
      },
    });

    return { message: 'Message recalled and deleted', conversationId, senderId };
  }

  /**
   * Mark messages as read
   */
  async markAsRead(conversationId, userId, { messageId, lastReadMessageId }) {
    // Check if user is a participant
    const participant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      throw new NotFoundError('Conversation');
    }

    // Find messages to mark as read
    const targetMessageId = lastReadMessageId || messageId;

    let messagesToMark;
    if (targetMessageId) {
      messagesToMark = await prisma.message.findMany({
        where: {
          conversationId,
          senderId: { not: userId },
          createdAt: { lte: (await prisma.message.findUnique({ where: { id: targetMessageId } }))?.createdAt },
        },
        orderBy: { createdAt: 'asc' },
      });
    } else {
      // Mark all unread messages
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

    if (messagesToMark.length === 0) {
      return { marked: 0 };
    }

    const latestMessage = messagesToMark[messagesToMark.length - 1];

    // Update message statuses
    await prisma.$transaction(
      messagesToMark.flatMap((msg) => [
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
        }),
      ])
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

    return { marked: messagesToMark.length, lastReadMessageId: latestMessage.id };
  }

  /**
   * Get pinned documents in a conversation
   */
  async getPinnedDocuments(conversationId, userId, { page = 1, limit = 20 } = {}) {
    // Check if user is a participant
    const participant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      throw new NotFoundError('Conversation');
    }

    const skip = (page - 1) * limit;

    const [pinnedDocs, total] = await Promise.all([
      prisma.pinnedDocument.findMany({
        where: { conversationId },
        include: {
          message: {
            select: {
              id: true,
              content: true,
              messageType: true,
              senderId: true,
              createdAt: true,
              metadata: true,
              sender: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          pinnedByUser: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { pinOrder: 'asc' },
        skip,
        take: limit,
      }),
      prisma.pinnedDocument.count({ where: { conversationId } }),
    ]);

    return {
      data: pinnedDocs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        pinOrder: doc.pinOrder,
        pinnedAt: doc.pinnedAt,
        message: {
          ...doc.message,
          originalName: doc.message.metadata?.originalName || null,
          filename: doc.message.metadata?.filename || null,
          thumbnailUrl: doc.message.metadata?.thumbnailUrl || null,
        },
        pinnedBy: doc.pinnedByUser,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Pin a message
   */
  async pinMessage(conversationId, userId, { messageId, title, description }) {
    // Check if user is a participant
    const participant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      throw new NotFoundError('Conversation');
    }

    // Check if message exists
    const message = await prisma.message.findFirst({
      where: { id: messageId, conversationId, isRecalled: false },
    });

    if (!message) {
      throw new NotFoundError('Message');
    }

    // Get max pin order
    const maxOrder = await prisma.pinnedDocument.aggregate({
      where: { conversationId },
      _max: { pinOrder: true },
    });

    const pinnedDoc = await prisma.pinnedDocument.create({
      data: {
        id: uuidv4(),
        conversationId,
        messageId,
        pinnedBy: userId,
        title,
        description,
        pinOrder: (maxOrder._max.pinOrder || 0) + 1,
      },
      include: {
        message: {
          select: {
            id: true,
            content: true,
            messageType: true,
            senderId: true,
            createdAt: true,
            metadata: true,
            sender: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        pinnedByUser: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      id: pinnedDoc.id,
      title: pinnedDoc.title,
      description: pinnedDoc.description,
      pinOrder: pinnedDoc.pinOrder,
      pinnedAt: pinnedDoc.pinnedAt,
      message: {
        ...pinnedDoc.message,
        originalName: pinnedDoc.message.metadata?.originalName || null,
        filename: pinnedDoc.message.metadata?.filename || null,
        thumbnailUrl: pinnedDoc.message.metadata?.thumbnailUrl || null,
      },
      pinnedBy: pinnedDoc.pinnedByUser,
    };
  }

  /**
   * Unpin a message
   */
  async unpinMessage(pinnedDocId, userId) {
    const pinnedDoc = await prisma.pinnedDocument.findFirst({
      where: { id: pinnedDocId },
    });

    if (!pinnedDoc) {
      throw new NotFoundError('Pinned document');
    }

    // Check if user is a participant in the conversation
    const participant = await prisma.conversationUser.findFirst({
      where: {
        conversationId: pinnedDoc.conversationId,
        userId,
        leftAt: null,
      },
    });

    if (!participant) {
      throw new AuthorizationError('Not authorized to unpin this document');
    }

    await prisma.pinnedDocument.delete({ where: { id: pinnedDocId } });

    return { message: 'Document unpinned' };
  }

  /**
   * Search messages in a conversation
   */
  async searchMessages(conversationId, userId, query, { page = 1, limit = 20 } = {}) {
    // Check if user is a participant
    const participant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      throw new NotFoundError('Conversation');
    }

    const skip = (page - 1) * limit;

    const where = {
      conversationId,
      isRecalled: false,
      content: {
        contains: query,
      },
    };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              status: true,
            },
          },
          statuses: {
            where: { userId },
            select: {
              status: true,
              seenAt: true,
              deliveredAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    const transformedMessages = messages.map((msg) => ({
      id: msg.id,
      content: msg.isRecalled ? null : msg.content,
      messageType: msg.messageType,
      metadata: msg.metadata,
      isEdited: msg.isEdited,
      isRecalled: msg.isRecalled,
      sender: msg.sender,
      status: msg.statuses[0]?.status || 'sent',
      seenAt: msg.statuses[0]?.seenAt,
      deliveredAt: msg.statuses[0]?.deliveredAt,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));

    return {
      data: transformedMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total,
      },
    };
  }

  /**
   * Get original name from message metadata
   * @param {string} messageId - Message ID
   * @returns {Object|null} Object containing originalName and file info
   */
  async getMessageFileOriginalName(messageId) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        messageType: true,
        metadata: true,
      },
    });

    if (!message) {
      throw new NotFoundError('Message');
    }

    // Check if metadata exists and contains originalName
    if (message.metadata && message.metadata.originalName) {
      return {
        messageId: message.id,
        messageType: message.messageType,
        originalName: message.metadata.originalName,
        filename: message.metadata.filename || null,
        url: message.metadata.url || null,
        size: message.metadata.size || null,
      };
    }

    return null;
  }

  /**
   * Get all images with originalName in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @param {Object} options - Pagination options
   * @returns {Object} Paginated results with images
   */
  async getConversationImages(conversationId, userId, { page = 1, limit = 50 } = {}) {
    // Check if user is a participant
    const participant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      throw new NotFoundError('Conversation');
    }

    const skip = (page - 1) * limit;

    const where = {
      conversationId,
      isRecalled: false,
      messageType: 'image',
    };

    const [images, total] = await Promise.all([
      prisma.message.findMany({
        where,
        select: {
          id: true,
          content: true,
          messageType: true,
          metadata: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    // Transform to include originalName from metadata
    const transformedImages = images.map((img) => ({
      id: img.id,
      content: img.content,
      messageType: img.messageType,
      originalName: img.metadata?.originalName || null,
      filename: img.metadata?.filename || null,
      url: img.metadata?.url || null,
      thumbnailUrl: img.metadata?.thumbnailUrl || null,
      width: img.metadata?.width || null,
      height: img.metadata?.height || null,
      size: img.metadata?.size || null,
      createdAt: img.createdAt,
      sender: img.sender,
    }));

    return {
      data: transformedImages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + images.length < total,
      },
    };
  }
}

export default new MessageService();
