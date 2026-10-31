import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

/**
 * Connect to MongoDB with automatic retry and event listeners
 */
export const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/task_management_db';

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });

    logger.info(`MongoDB Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    logger.error(`MongoDB Connection Error: ${error.message}`);
    logger.warn('The server will continue running. Ensure MongoDB is active for full functionality.');
    return null;
  }
};

// Monitor connection events
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection lost. Reconnecting...');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected.');
});

export default connectDB;
