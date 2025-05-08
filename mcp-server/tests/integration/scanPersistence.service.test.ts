import { RepositoryScanModel } from '@/models/RepositoryScan.model';
import scanPersistenceService from '@/services/scanPersistence.service';
import logger from '@/utils/logger';

// Mock the MongoDB models and utilities
jest.mock('@/models/RepositoryScan.model', () => ({
  RepositoryScanModel: {
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    deleteOne: jest.fn(),
  }
}));

jest.mock('@/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('ScanPersistence Service', () => {
  const mockScanId = 'test-scan-id';
  const mockFiles = [{ path: 'test/file.ts', type: 'typescript', category: 'code' }];
  const mockOptions = { includePatterns: ['**/*.ts'], excludePatterns: [] };
  const mockRepoPath = '/test/repo';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveScanResult', () => {
    it('should save a scan result successfully', async () => {
      const mockResult = {
        scanId: mockScanId,
        version: 1,
      };

      // Mock the findOneAndUpdate method to return a successful result
      (RepositoryScanModel.findOneAndUpdate as jest.Mock).mockResolvedValue(mockResult);

      const result = await scanPersistenceService.saveScanResult(
        mockRepoPath,
        mockOptions,
        mockFiles
      );

      expect(result).toBe(mockScanId);
      expect(RepositoryScanModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle errors when saving a scan result', async () => {
      const errorMessage = 'Database error';
      (RepositoryScanModel.findOneAndUpdate as jest.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(
        scanPersistenceService.saveScanResult(mockRepoPath, mockOptions, mockFiles)
      ).rejects.toThrow(`Failed to save scan result: ${errorMessage}`);
    });
  });

  describe('getScanResult', () => {
    it('should get a scan result successfully', async () => {
      const mockScan = { scanId: mockScanId };
      (RepositoryScanModel.findOne as jest.Mock).mockResolvedValue(mockScan);

      const result = await scanPersistenceService.getScanResult(mockScanId);
      expect(result).toEqual(mockScan);
      expect(RepositoryScanModel.findOne).toHaveBeenCalledWith({ scanId: mockScanId });
    });

    it('should return null when scan not found', async () => {
      (RepositoryScanModel.findOne as jest.Mock).mockResolvedValue(null);

      const result = await scanPersistenceService.getScanResult(mockScanId);
      expect(result).toBeNull();
    });
  });

  // Brief tests for remaining methods
  describe('listScans', () => {
    it('should list scans successfully', async () => {
      const mockScans = [{ scanId: mockScanId }];
      (RepositoryScanModel.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(mockScans)
            })
          })
        })
      });

      const result = await scanPersistenceService.listScans();
      expect(result).toEqual(mockScans);
    });
  });

  describe('deleteScanResult', () => {
    it('should delete a scan result successfully', async () => {
      (RepositoryScanModel.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });

      const result = await scanPersistenceService.deleteScanResult(mockScanId);
      expect(result).toBe(true);
    });

    it('should return false when no scan was deleted', async () => {
      (RepositoryScanModel.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 0 });

      const result = await scanPersistenceService.deleteScanResult(mockScanId);
      expect(result).toBe(false);
    });
  });
}); 