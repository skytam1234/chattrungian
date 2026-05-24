import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDbPath = path.join(__dirname, '..', 'test-msg.db');
const testSchemaPath = path.join(__dirname, '..', 'prisma', 'schema-test.prisma');

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${testDbPath}`,
    },
  },
});

let app;
let authToken;
let user1, user2;
let conversation;

async function setupApp() {
  if (!app) {
    const express = (await import('express')).default;
    app = express();
    app.use(express.json());
    
    const authRoutes = (await import('../src/routes/auth.routes.js')).default;
    const conversationMessageRoutes = (await import('../src/routes/conversation-message.routes.js')).default;
    const messageRoutes = (await import('../src/routes/message.routes.js')).default;
    const { errorHandler } = await import('../src/utils/errors.js');
    const { corsMiddleware } = await import('../src/middleware/cors.middleware.js');
    
    app.use(corsMiddleware);
    app.use('/api/auth', authRoutes);
    app.use('/api/conversations', conversationMessageRoutes);
    app.use('/api/messages', messageRoutes);
    app.use(errorHandler);
  }
  return app;
}

async function cleanupDatabase() {
  try {
    await prisma.messageStatus.deleteMany({});
    await prisma.unreadMessage.deleteMany({});
    await prisma.pinnedDocument.deleteMany({});
    await prisma.groupMember.deleteMany({});
    await prisma.conversationUser.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({});
  } catch (e) {
    // Ignore
  }
}

async function initDatabase() {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  try {
    execSync(`npx prisma db push --schema="${testSchemaPath}" --accept-data-loss --skip-generate`, {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: `file:${testDbPath}` }
    });
  } catch (e) {
    console.warn('Database setup:', e.message);
  }
}

async function login(email) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'password123' });
  return response.body.data?.accessToken;
}

describe('Message API', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.BCRYPT_ROUNDS = '4';
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = `file:${testDbPath}`;
    
    await initDatabase();
    await setupApp();
    
    // Create test users
    const passwordHash = await bcrypt.hash('password123', 4);
    
    user1 = await prisma.user.create({
      data: {
        id: uuidv4(),
        username: 'msguser1',
        email: 'msguser1@example.com',
        passwordHash,
        displayName: 'Msg User One',
        isVerified: true,
      },
    });
    
    user2 = await prisma.user.create({
      data: {
        id: uuidv4(),
        username: 'msguser2',
        email: 'msguser2@example.com',
        passwordHash,
        displayName: 'Msg User Two',
        isVerified: true,
      },
    });
    
    // Create conversation
    conversation = await prisma.conversation.create({
      data: {
        id: uuidv4(),
        type: 'direct',
        createdBy: user1.id,
        users: {
          create: [
            { userId: user1.id, role: 'member' },
            { userId: user2.id, role: 'member' },
          ],
        },
      },
    });
    
    authToken = await login('msguser1@example.com');
  }, 30000);
  
  afterAll(async () => {
    await prisma.$disconnect();
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });
  
  beforeEach(async () => {
    await cleanupDatabase();
    // Recreate conversation
    conversation = await prisma.conversation.create({
      data: {
        id: uuidv4(),
        type: 'direct',
        createdBy: user1.id,
        users: {
          create: [
            { userId: user1.id, role: 'member' },
            { userId: user2.id, role: 'member' },
          ],
        },
      },
    });
  });
  
  describe('GET /api/conversations/:id/messages', () => {
    it('should return empty messages list', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversation.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });
    
    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversation.id}/messages`);
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('POST /api/conversations/:id/messages', () => {
    it('should send a message', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversation.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Hello, World!',
          messageType: 'text',
        });
      
      expect(response.status).toBe(201);
      expect(response.body.data.content).toBe('Hello, World!');
    });
  });
  
  describe('POST /api/messages/read', () => {
    it('should mark conversation as read', async () => {
      const response = await request(app)
        .post('/api/messages/read')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          conversationId: conversation.id,
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
