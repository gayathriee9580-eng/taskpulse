import { Server } from 'socket.io';
import { corsOptions } from '../config/corsConfig.js';
import { logger } from '../utils/logger.js';
import { verifyToken } from '../services/tokenService.js';
import { User } from '../models/User.js';

let io = null;

/**
 * Initialize Socket.IO with HTTP server and secure JWT authentication
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: corsOptions,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Strict Socket.IO authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required. Missing token.'));
      }

      let decoded;
      try {
        decoded = verifyToken(token);
      } catch (err) {
        return next(new Error('Authentication failed. Invalid or expired token.'));
      }

      if (!decoded?.id) {
        return next(new Error('Authentication failed. Malformed token payload.'));
      }

      // Load user directly from MongoDB to verify account state
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('Authentication failed. User not found.'));
      }

      if (!user.isActive) {
        return next(new Error('Authentication failed. Account has been deactivated.'));
      }

      // Attach authenticated user to socket instance
      socket.user = user;
      next();
    } catch (error) {
      logger.error(`Socket handshake error: ${error.message}`);
      next(new Error('Internal socket authentication error.'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    logger.info(`⚡ Socket connected: ${socket.id} (User: ${user.email}, Role: ${user.role})`);

    // Server-managed rooms only:
    // 1. Individual secure user room
    socket.join(`user:${user._id.toString()}`);

    // 2. Role-specific notification rooms
    if (user.role === 'admin') {
      socket.join('admins');
    } else if (user.role === 'manager') {
      socket.join('managers');
    }

    // Health ping-pong
    socket.on('client:ping', () => {
      socket.emit('server:pong', { timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', (reason) => {
      logger.info(`🔌 Socket disconnected: ${socket.id} (Reason: ${reason})`);
    });
  });

  logger.success('Secure Socket.IO initialized successfully');
  return io;
};

/**
 * Get active Socket.IO server instance
 */
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO is not initialized! Call initSocket first.');
  }
  return io;
};

/**
 * Dispatch real-time task events strictly to authorized participants and admins
 * @param {Object} task - Mongoose task document or plain object
 * @param {string} eventName - e.g. 'task:created', 'task:updated', 'task:statusChanged', 'task:deleted', 'task:reordered'
 * @param {Object} extraData - Additional metadata
 */
export const notifyTaskParticipants = (task, eventName, extraData = {}) => {
  if (!io) return;

  const taskId = task?._id?.toString() || task?.id?.toString() || task?.toString();
  const minimalPayload = {
    taskId,
    action: eventName,
    title: task?.title || extraData?.title || '',
    status: task?.status || extraData?.status,
    order: task?.order ?? extraData?.order,
    timestamp: new Date().toISOString(),
    ...extraData,
  };

  // 1. Notify all admins in the workspace
  io.to('admins').emit(eventName, minimalPayload);

  // 2. Notify assigned user if present
  const assignedToId = task?.assignedTo?._id?.toString() || task?.assignedTo?.toString();
  if (assignedToId) {
    io.to(`user:${assignedToId}`).emit(eventName, minimalPayload);
  }

  // 3. Notify creator (manager or admin)
  const createdById = task?.createdBy?._id?.toString() || task?.createdBy?.toString();
  if (createdById && createdById !== assignedToId) {
    io.to(`user:${createdById}`).emit(eventName, minimalPayload);
  }

  // 4. Notify assigner if present and distinct
  const assignedById = task?.assignedBy?._id?.toString() || task?.assignedBy?.toString();
  if (assignedById && assignedById !== assignedToId && assignedById !== createdById) {
    io.to(`user:${assignedById}`).emit(eventName, minimalPayload);
  }
};

/**
 * Send real-time notification to an individual user room
 */
export const emitToUser = (userId, eventName, payload) => {
  if (!io || !userId) return;
  const uid = userId.toString();
  io.to(`user:${uid}`).emit(eventName, {
    ...payload,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send event to admin notification room
 */
export const emitToAdmins = (eventName, payload) => {
  if (!io) return;
  io.to('admins').emit(eventName, {
    ...payload,
    timestamp: new Date().toISOString(),
  });
};

export default {
  initSocket,
  getIO,
  notifyTaskParticipants,
  emitToUser,
  emitToAdmins,
};
