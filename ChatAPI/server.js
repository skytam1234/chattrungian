import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './src/config/index.js';
import { corsMiddleware, preflightHandler } from './src/middleware/cors.middleware.js';
import { notFoundHandler } from './src/middleware/notFound.middleware.js';
import { responseNormalizer, responseTimeHeader, securityHeaders } from './src/middleware/response.middleware.js';
import { errorHandler } from './src/middleware/error.middleware.js';
import { initializeSocket } from './src/socket/index.js';

// Import routes
import authRoutes from './src/routes/auth.routes.js';
import userRoutes from './src/routes/user.routes.js';
import conversationRoutes from './src/routes/conversation.routes.js';
import conversationMessageRoutes from './src/routes/conversation-message.routes.js';
import messageRoutes from './src/routes/message.routes.js';
import uploadRoutes from './src/routes/upload.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate config
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
const missing = requiredEnvVars.filter(v => !process.env[v]);

if (missing.length > 0 && config.nodeEnv === 'production') {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// Create Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = initializeSocket(httpServer);

// Trust proxy for getting real IP
app.set('trust proxy', 1);

// Security & response headers
app.use(securityHeaders);
app.use(responseTimeHeader);
app.use(responseNormalizer);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from DATA folder
app.use('/uploads', express.static(path.join(__dirname, 'DATA')));

// CORS
app.use(corsMiddleware);

// Request logging
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/conversations', conversationMessageRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);

// Preflight handler for CORS
app.options('*', preflightHandler);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
const PORT = config.port;

httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    Chat API Server                        ║
╠════════════════════════════════════════════════════════════╣
║  HTTP Server:  http://localhost:${PORT.toString().padEnd(36)}║
║  Socket.IO:    ws://localhost:${PORT.toString().padEnd(40)}║
║  Environment:  ${config.nodeEnv.padEnd(42)}║
║  Frontend URL: ${config.frontendUrl.padEnd(42)}║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, httpServer, io };
