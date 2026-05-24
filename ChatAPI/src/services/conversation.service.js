import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, AuthorizationError, ValidationError } from '../middleware/error.middleware.js';
import prisma from '../config/prisma.js';
import socketService from '../socket/services/socket.service.js';

export class ConversationService {
  /**
   * Get all conversations for a user
   */
  async getConversations(userId, { page = 1, limit = 20, search } = {}) {
    const skip = (page - 1) * limit;

    const where = {
      users: {
        some: { userId },
      },
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          {
            users: {
              some: {
                user: {
                  OR: [
                    { displayName: { contains: search, mode: 'insensitive' } },
                    { username: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
        ],
      }),
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  status: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              content: true,
              senderId: true,
              messageType: true,
              createdAt: true,
              sender: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          unreadMessages: {
            where: { userId },
            select: {
              unreadCount: true,
              lastUnreadAt: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    // Transform the data
    const transformedConversations = conversations.map((conv) => {
      const currentUserRole = conv.users.find((u) => u.userId === userId)?.role;
      const lastMessage = conv.messages[0];
      const unread = conv.unreadMessages[0];

      return {
        id: conv.id,
        type: conv.type,
        name: conv.name,
        avatarUrl: conv.avatarUrl,
        description: conv.description,
        isArchived: conv.isArchived,
        currentUserRole,
        lastMessage: lastMessage || null,
        unreadCount: unread?.unreadCount || 0,
        lastUnreadAt: unread?.lastUnreadAt || null,
        participants: conv.users.map((u) => ({
          id: u.user.id,
          username: u.user.username,
          displayName: u.user.displayName,
          avatarUrl: u.user.avatarUrl,
          status: u.user.status,
          role: u.role,
          nickname: u.nickname,
          isMuted: u.isMuted,
          isPinned: u.isPinned,
          notifications: u.notifications,
          isOnline: socketService.isUserOnline(u.user.id),
        })),
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        lastMessageAt: conv.lastMessageAt,
      };
    });

    return {
      data: transformedConversations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(conversationId, userId) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        users: { some: { userId } },
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
        unreadMessages: {
          where: { userId },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation');
    }

    const currentUserRole = conversation.users.find((u) => u.userId === userId)?.role;

    return {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      avatarUrl: conversation.avatarUrl,
      description: conversation.description,
      currentUserRole,
      participants: conversation.users.map((u) => ({
        id: u.user.id,
        username: u.user.username,
        displayName: u.user.displayName,
        avatarUrl: u.user.avatarUrl,
        status: u.user.status,
        role: u.role,
        nickname: u.nickname,
        isMuted: u.isMuted,
        isPinned: u.isPinned,
        notifications: u.notifications,
        isOnline: socketService.isUserOnline(u.user.id),
      })),
      unreadCount: conversation.unreadMessages[0]?.unreadCount || 0,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  /**
   * Create a new conversation
   */
  async createConversation(userId, { type, name, description, participantIds, targetUserId }) {
    const conversationId = uuidv4();

    if (type === 'direct') {
      if (!targetUserId) {
        throw new ValidationError('Target user ID is required for direct conversations');
      }

      // Check if direct conversation already exists
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          type: 'direct',
          AND: [
            { users: { some: { userId } } },
            { users: { some: { userId: targetUserId } } },
          ],
        },
      });

      if (existingConversation) {
        return this.getConversationById(existingConversation.id, userId);
      }

      // Create direct conversation
      const conversation = await prisma.conversation.create({
        data: {
          id: conversationId,
          type: 'direct',
          createdBy: userId,
          users: {
            create: [
              { userId, role: 'member' },
              { userId: targetUserId, role: 'member' },
            ],
          },
        },
        include: {
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      return this.formatConversation(conversation, userId);
    } else {
      // Create group conversation
      if (!name) {
        throw new ValidationError('Group name is required for group conversations');
      }

      if (!participantIds || participantIds.length === 0) {
        throw new ValidationError('At least one participant is required for group conversations');
      }

      // Add creator to participants
      const allParticipantIds = [...new Set([userId, ...participantIds])];

      const conversation = await prisma.conversation.create({
        data: {
          id: conversationId,
          type: 'group',
          name,
          description,
          createdBy: userId,
          users: {
            create: allParticipantIds.map((id, index) => ({
              userId: id,
              role: index === 0 ? 'owner' : 'member',
            })),
          },
        },
        include: {
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      return this.formatConversation(conversation, userId);
    }
  }

  /**
   * Update a conversation
   */
  async updateConversation(conversationId, userId, { name, description, avatarUrl }) {
    // Check if user is admin or owner
    const participant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId },
    });

    if (!participant || !['owner', 'admin'].includes(participant.role)) {
      throw new AuthorizationError('Only admins can update conversation');
    }

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
    });

    return conversation;
  }

  /**
   * Delete/leave a conversation
   */
  async deleteConversation(conversationId, userId) {
    // Check if user is a member
    const participant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      throw new NotFoundError('Conversation');
    }

    if (participant.role === 'owner') {
      // Delete entire conversation if owner
      await prisma.conversation.delete({ where: { id: conversationId } });
    } else {
      // Just leave the conversation
      await prisma.conversationUser.delete({
        where: {
          conversationId_userId: { conversationId, userId },
        },
      });
    }

    return { message: 'Conversation deleted/left successfully' };
  }

  /**
   * Add participants to a conversation
   */
  async addParticipants(conversationId, userId, participantIds) {
    // Check if user is admin or owner
    const currentParticipant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId },
    });

    if (!currentParticipant || !['owner', 'admin'].includes(currentParticipant.role)) {
      throw new AuthorizationError('Only admins can add participants');
    }

    // Add new participants
    await prisma.conversationUser.createMany({
      data: participantIds.map((id) => ({
        conversationId,
        userId: id,
        role: 'member',
      })),
      skipDuplicates: true,
    });

    return { message: 'Participants added successfully' };
  }

  /**
   * Remove a participant from a conversation
   */
  async removeParticipant(conversationId, userId, targetUserId) {
    // Check if user is admin or owner, or removing themselves
    const currentParticipant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId },
    });

    const targetParticipant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId: targetUserId },
    });

    if (!targetParticipant) {
      throw new NotFoundError('Participant');
    }

    // Can only remove if: is admin/owner, or removing themselves
    if (
      currentParticipant?.userId !== userId &&
      (!currentParticipant || !['owner', 'admin'].includes(currentParticipant.role))
    ) {
      throw new AuthorizationError('Not authorized to remove this participant');
    }

    // Cannot remove owner
    if (targetParticipant.role === 'owner') {
      throw new ValidationError('Cannot remove the owner');
    }

    await prisma.conversationUser.delete({
      where: {
        conversationId_userId: { conversationId, userId: targetUserId },
      },
    });

    return { message: 'Participant removed successfully' };
  }

  /**
   * Toggle pin conversation
   */
  async togglePin(conversationId, userId) {
    const participant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      throw new NotFoundError('Conversation');
    }

    await prisma.conversationUser.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { isPinned: !participant.isPinned },
    });

    return { isPinned: !participant.isPinned };
  }

  /**
   * Toggle mute conversation
   */
  async toggleMute(conversationId, userId) {
    const participant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      throw new NotFoundError('Conversation');
    }

    await prisma.conversationUser.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { isMuted: !participant.isMuted },
    });

    return { isMuted: !participant.isMuted };
  }

  /**
   * Get conversation members
   */
  async getMembers(conversationId, userId) {
    const participant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      throw new NotFoundError('Conversation');
    }

    const members = await prisma.conversationUser.findMany({
      where: { conversationId, leftAt: null },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return members;
  }

  /**
   * Leave a conversation
   */
  async leaveConversation(conversationId, userId) {
    const participant = await prisma.conversationUser.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      throw new NotFoundError('Conversation');
    }

    if (participant.role === 'owner') {
      throw new ValidationError('Người tạo nhóm không thể rời đi. Hãy chuyển quyền cho người khác trước.');
    }

    await prisma.conversationUser.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { leftAt: new Date() },
    });

    return { message: 'Đã rời khỏi cuộc trò chuyện' };
  }

  /**
   * Format conversation for response
   */
  formatConversation(conversation, userId) {
    const currentUserRole = conversation.users.find((u) => u.userId === userId)?.role;

    return {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      avatarUrl: conversation.avatarUrl,
      description: conversation.description,
      currentUserRole,
      participants: conversation.users.map((u) => ({
        id: u.user.id,
        username: u.user.username,
        displayName: u.user.displayName,
        avatarUrl: u.user.avatarUrl,
        status: u.user.status,
        role: u.role,
        isOnline: socketService.isUserOnline(u.user.id),
      })),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }
}

export default new ConversationService();
