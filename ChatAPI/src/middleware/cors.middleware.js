import cors from 'cors';
import config from '../config/index.js';

// CORS configuration
export const corsMiddleware = cors({
  origin: config.frontendUrl,
  credentials: config.cors.credentials,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
  maxAge: 86400,
});

// Preflight handler
export const preflightHandler = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', config.frontendUrl);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', config.cors.methods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', config.cors.allowedHeaders.join(', '));
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
};

export default {
  corsMiddleware,
  preflightHandler,
};
