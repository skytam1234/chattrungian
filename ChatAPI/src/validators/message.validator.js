import { z } from 'zod';

// Create conversation schema
export const createConversationSchema = z.object({
  type: z.enum(['direct', 'group']),
  name: z.string().max(100).optional(),
  description: z.string().optional(),
  participantIds: z.array(z.string().uuid()).optional(), // For group conversations
  targetUserId: z.string().uuid().optional(), // For direct conversations
});

// Update conversation schema
export const updateConversationSchema = z.object({
  name: z.string().max(100).optional(),
  description: z.string().optional(),
  avatarUrl: z.string().optional().nullable(),
});

// Add participants schema
export const addParticipantsSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, 'At least one user ID is required'),
});

// Update role schema
export const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'member']),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

// Message schemas
export const sendMessageSchema = z.object({
  content: z.string().optional(),
  messageType: z.enum(['text', 'image', 'file', 'video', 'audio', 'sticker', 'system']).default('text'),
  metadata: z.record(z.any()).optional(),
  replyToId: z.string().uuid().optional(),
  tempId: z.string().optional(), // For optimistic updates
});

export const updateMessageSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty'),
});

export const markReadSchema = z.object({
  conversationId: z.string().min(1, 'conversationId là bắt buộc'),
  messageId: z.string().optional().nullable(),
});

// Pin document schema
export const pinDocumentSchema = z.object({
  messageId: z.string().uuid(),
  title: z.string().max(255).optional(),
  description: z.string().optional(),
});

// Validation middleware factory
export const validate = (schema) => {
  return (req, res, next) => {
    try {
      const result = schema.parse(req.body);
      req.body = result;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors,
          timestamp: new Date().toISOString(),
        });
      }
      next(error);
    }
  };
};

export default {
  createConversationSchema,
  updateConversationSchema,
  addParticipantsSchema,
  updateRoleSchema,
  paginationSchema,
  sendMessageSchema,
  updateMessageSchema,
  markReadSchema,
  pinDocumentSchema,
  validate,
};
