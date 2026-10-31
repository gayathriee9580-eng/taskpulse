import mongoose from 'mongoose';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @desc    API System Health Check
 * @route   GET /api/health
 * @access  Public
 */
export const checkHealth = asyncHandler(async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  const healthData = {
    service: 'TaskPulse API',
    status: 'healthy',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
      name: mongoose.connection.name || 'none',
    },
    version: '1.0.0',
  };

  return sendSuccess(res, 200, 'Service is healthy and operating normally', healthData);
});

export default {
  checkHealth,
};
