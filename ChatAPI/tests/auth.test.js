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
const testDbPath = path.join(__dirname, '..', 'test-auth.db');
const testSchemaPath = path.join(__dirname, '..', 'prisma', 'schema-test.prisma');

// Set environment variables BEFORE importing anything
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.JWT_SECRET = 'test-secret-key';
process.env.BCRYPT_ROUNDS = '4';
process.env.NODE_ENV = 'test';

// Now import after setting env
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

let app;

async function setupApp() {
  if (!app) {
    const express = (await import('express')).default;
    app = express();
    app.use(express.json());
    
    const authRoutes = (await import('../src/routes/auth.routes.js')).default;
    const { errorHandler } = await import('../src/utils/errors.js');
    const { corsMiddleware } = await import('../src/middleware/cors.middleware.js');
    
    app.use(corsMiddleware);
    app.use('/api/auth', authRoutes);
    app.use(errorHandler);
  }
  return app;
}

async function cleanupDatabase() {
  try {
    await prisma.session.deleteMany({});
    await prisma.unreadMessage.deleteMany({});
    await prisma.messageStatus.deleteMany({});
    await prisma.pinnedDocument.deleteMany({});
    await prisma.groupMember.deleteMany({});
    await prisma.conversationUser.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.conversation.deleteMany({});
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
      env: { ...process.env }
    });
    console.log('Auth test database initialized');
  } catch (e) {
    console.warn('Database setup:', e.message);
  }
}

describe('Auth API', () => {
  beforeAll(async () => {
    await initDatabase();
    await setupApp();
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
  
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'password123',
          displayName: 'New User',
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.accessToken).toBeDefined();
    });
    
    it('should reject duplicate email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user1',
          email: 'test@example.com',
          password: 'password123',
          displayName: 'Test User',
        });
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user2',
          email: 'test@example.com',
          password: 'password123',
          displayName: 'Test User 2',
        });
      
      expect(response.status).toBe(409);
    });
    
    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'invalid-email',
          password: 'password123',
          displayName: 'New User',
        });
      
      expect(response.status).toBe(400);
    });
    
    it('should reject short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'short',
          displayName: 'New User',
        });
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('password123', 4);
      await prisma.user.create({
        data: {
          id: uuidv4(),
          username: 'testuser',
          email: 'test@example.com',
          passwordHash,
          displayName: 'Test User',
          isVerified: true,
        },
      });
    });
    
    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });
    
    it('should reject wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });
      
      expect(response.status).toBe(401);
    });
    
    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('GET /api/auth/me', () => {
    it('should return user with valid token', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testme',
          email: 'me@example.com',
          password: 'password123',
          displayName: 'Test Me',
        });
      
      const token = registerRes.body.data?.accessToken;
      expect(token).toBeDefined();
      
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.email).toBe('me@example.com');
    });
    
    it('should reject without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const loginRes = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'refreshuser',
          email: 'refresh@example.com',
          password: 'password123',
          displayName: 'Refresh User',
        });
      
      const refreshToken = loginRes.body.data?.refreshToken;
      expect(refreshToken).toBeDefined();
      
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBeDefined();
    });
  });
});
