import mongoose from 'mongoose';

import config from '@/config';
import logger from '@/utils/logger';

let isConnected = false;
let connectionAttempted = false;

export async function connectDB(): Promise<boolean> {
  if (isConnected) {
    logger.info('MongoDB already connected.');
    return true;
  }
  if (connectionAttempted && process.env.NODE_ENV === 'test') {
    logger.warn('MongoDB connection previously attempted in test environment. Skipping new attempt.');
    return false;
  }

  connectionAttempted = true;

  try {
    logger.info(`Attempting to connect to MongoDB at ${config.db.mongoUri}...`);
    await mongoose.connect(config.db.mongoUri, {
      serverSelectionTimeoutMS: (process.env.NODE_ENV === 'test' ? 1000 : 5000),
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    if (!mongoose.connection.listeners('connected').length) {
        mongoose.connection.on('connected', () => {
            logger.info('MongoDB connected successfully.');
            isConnected = true;
        });
        mongoose.connection.on('error', (err) => {
            logger.error(`MongoDB connection error: ${err.message}`, { error: err });
            isConnected = false;
        });
        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected.');
            isConnected = false;
        });
    }
    return true;
  } catch (error: any) {
    logger.error(`MongoDB initial connection error: ${error.message}`, { error });
    isConnected = false;
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(`Failed to connect to MongoDB: ${error.message}`);
    }
    return false;
  }
}

export function getDB(): mongoose.Connection | null {
  if (!isConnected || !mongoose.connection) {
    if (process.env.NODE_ENV === 'test') {
        logger.warn('getDB called but database not connected in test environment.');
        return null;
    }
    throw new Error('Database not connected. Call connectDB first.');
  }
  return mongoose.connection;
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection && mongoose.connection.readyState !== 0) {
    try {
        await mongoose.disconnect();
        logger.info('MongoDB disconnected successfully.');
    } catch (error: any) {
        logger.error('Error disconnecting MongoDB:', error);
    }
  }
  isConnected = false;
  connectionAttempted = false;
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received. Closing MongoDB connection...');
  await disconnectDB();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Closing MongoDB connection...');
  await disconnectDB();
  process.exit(0);
}); 