import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { ScanPersistenceService } from '@/services/scanPersistence.service';
import { connectDB, disconnectDB } from '@/core/db';

describe('ScanPersistenceService', () => {
  let mongoServer: MongoMemoryServer;
  let persistenceService: ScanPersistenceService;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri; // Set for connectDB
    await connectDB();
    persistenceService = new ScanPersistenceService();
  });

  afterAll(async () => {
    await disconnectDB();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  });

  describe('saveScanResult', () => {
    it('should be defined', () => {
      expect(persistenceService.saveScanResult).toBeDefined();
    });
    // Add tests for saveScanResult
  });

  describe('getScanResultById', () => {
    it('should be defined', () => {
      expect(persistenceService.getScanResultById).toBeDefined();
    });
    // Add tests for getScanResultById
  });

  describe('listScanResults', () => {
    it('should be defined', () => {
      expect(persistenceService.listScanResults).toBeDefined();
    });
    // Add tests for listScanResults
  });

  describe('deleteScanResult', () => {
    it('should be defined', () => {
      expect(persistenceService.deleteScanResult).toBeDefined();
    });
    // Add tests for deleteScanResult
  });
}); 