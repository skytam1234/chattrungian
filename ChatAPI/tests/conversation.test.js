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
const testDbPath = path.join(__dirname, '..', 'test-conv.db');
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
let user1, user2, user3;

async function setupApp() {
  if (!app) {
    const express = (await import('express')).default;
    app = express();
    app.use(express.json());
    
    const authRoutes = (await import('../src/routes/auth.routes.js')).default;
    const conversationRoutes = (await import('../src/routes/conversation.routes.js')).default;
    const { errorHandler } = await import('../src/utils/errors.js');
    const { corsMiddleware } = await import('../src/middleware/cors.middleware.js');
    
    app.use(corsMiddleware);
    app.use('/api/auth', authRoutes);
    app.use('/api/conversations', conversationRoutes);
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

describe('Conversation API', () => {
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
        username: 'convuser1',
        email: 'convuser1@example.com',
        passwordHash,
        displayName: 'Conv User One',
        isVerified: true,
      },
    });
    
    user2 = await prisma.user.create({
      data: {
        id: uuidv4(),
        username: 'convuser2',
        email: 'convuser2@example.com',
        passwordHash,
        displayName: 'Conv User Two',
        isVerified: true,
      },
    });
    
    user3 = await prisma.user.create({
      data: {
        id: uuidv4(),
        username: 'convuser3',
        email: 'convuser3@example.com',
        passwordHash,
        displayName: 'Conv User Three',
        isVerified: true,
      },
    });
    
    authToken = await login('convuser1@example.com');
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
  });
  
  describe('GET /api/conversations', () => {
    it('should return empty list when no conversations', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });
    
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/conversations');
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('POST /api/conversations', () => {
    it('should create a direct conversation', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'direct',
          targetUserId: user2.id,
        });
      
      expect(response.status).toBe(201);
      expect(response.body.data.type).toBe('direct');
    });
    
    it('should create a group conversation', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'group',
          name: 'Test Group',
          participantIds: [user2.id, user3.id],
        });
      
      expect(response.status).toBe(201);
      expect(response.body.data.type).toBe('group');
      expect(response.body.data.name).toBe('Test Group');
    });
    
    it('should require name for group conversation', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'group',
          participantIds: [user2.id],
        });
      
      expect(response.status).toBe(400);
    });
  });
});
