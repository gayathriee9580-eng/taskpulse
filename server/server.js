import http from 'http';
import { fileURLToPath } from 'url';
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// Load environment variables before importing configs
dotenv.config();

import { connectDB } from './config/db.js';
import { corsOptions } from './config/corsConfig.js';
import { initSocket } from './socket/index.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './utils/appError.js';
import { logger } from './utils/logger.js';

// Initialize express app
const app = express();
const server = http.createServer(app);

// Security & utility middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Root entry point
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'TaskPulse API',
    description: 'Enterprise Multi-Role Task Management System Backend',
    status: 'online',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// Mount modular API routes
app.use('/api', apiRouter);

// Catch unhandled 404 routes
app.all('*', (req, res, next) => {
  next(new AppError(`Cannot find endpoint ${req.method} ${req.originalUrl} on this server`, 404));
});

// Centralized error handling middleware
app.use(errorHandler);

// Initialize Socket.IO
initSocket(server);

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to Database
  await connectDB();

  server.listen(PORT, () => {
    logger.success(`====================================================`);
    logger.success(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    logger.success(`🌐 API Base URL: http://localhost:${PORT}/api`);
    logger.success(`🔌 Socket.IO initialized on port ${PORT}`);
    logger.success(`====================================================`);
  });
};

// Handle process termination and unexpected errors
process.on('unhandledRejection', (err) => {
  logger.error(`UNHANDLED REJECTION: ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err);
  }
});

process.on('uncaughtException', (err) => {
  logger.error(`UNCAUGHT EXCEPTION: ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err);
  }
  process.exit(1);
});

// Graceful process shutdown for Render & containerized platforms
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Initiating graceful shutdown...`);
  server.close(() => {
    logger.info('HTTP & WebSocket servers closed.');
    mongoose.connection.close(false).then(() => {
      logger.info('MongoDB database connection closed.');
      process.exit(0);
    });
  });

  // Force close after 10s timeout
  setTimeout(() => {
    logger.error('Forced shutdown due to 10s timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Run server listener when executed directly (or connect DB when imported by test suites)
const isMainModule = () => {
  try {
    if (!process.argv[1]) return false;
    const currentFile = fileURLToPath(import.meta.url).toLowerCase();
    const executedFile = process.argv[1].toLowerCase();
    return currentFile === executedFile || executedFile.endsWith('server.js');
  } catch (e) {
    return false;
  }
};

if (isMainModule()) {
  startServer();
} else {
  connectDB();
}

export { app, server };
