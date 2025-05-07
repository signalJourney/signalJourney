import mongoose from 'mongoose';
import config from '@/config';
import logger from '@/utils/logger';

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) {
    logger.info('MongoDB already connected.');
    return;
  }

  try {
    logger.info(`Attempting to connect to MongoDB at ${config.db.mongoUri}...`);
    await mongoose.connect(config.db.mongoUri, {
      // Recommended options for modern Mongoose
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      // Mongoose 6+ handles these automatically: useNewUrlParser, useUnifiedTopology, useCreateIndex, useFindAndModify
    });
    isConnected = true;

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
      // Optional: Implement reconnection logic here if needed
    });

  } catch (error: any) {
    logger.error(`MongoDB initial connection error: ${error.message}`, { error });
    // Exit process on initial connection failure? Or allow server to run without DB?
    // For now, throw to prevent server start without DB.
    throw new Error(`Failed to connect to MongoDB: ${error.message}`);
  }
}

export function getDB(): mongoose.Connection {
  if (!isConnected || !mongoose.connection) {
    throw new Error('Database not connected. Call connectDB first.');
  }
  return mongoose.connection;
}

export async function disconnectDB(): Promise<void> {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB disconnected successfully.');
  }
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