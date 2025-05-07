import { RepositoryScannerService, TraversalOptions } from '@/services/repositoryScanner.service';

// Mock 'fs/promises' and 'glob'
jest.mock('fs/promises');
jest.mock('glob');

describe('RepositoryScannerService', () => {
  let scannerService: RepositoryScannerService;
  let mockOptions: TraversalOptions;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    mockOptions = {
      include: ['**/*'],
      exclude: ['node_modules/**', '.git/**'],
      maxDepth: 10,
      followSymlinks: false,
    };
    scannerService = new RepositoryScannerService(mockOptions);
  });

  describe('scanRepository', () => {
    it('should be defined', () => {
      expect(scannerService.scanRepository).toBeDefined();
    });
    // Add more tests for scanRepository
  });

  describe('detectFileTypeAndCategory', () => {
    it('should be defined', () => {
      // @ts-expect-error // Accessing private method for testing
      expect(scannerService.detectFileTypeAndCategory).toBeDefined();
    });
    // Add more tests for detectFileTypeAndCategory
  });

  describe('extractBasicCodeMetadata', () => {
    it('should be defined', () => {
      // @ts-expect-error // Accessing private method for testing
      expect(scannerService.extractBasicCodeMetadata).toBeDefined();
    });
    // Add more tests for extractBasicCodeMetadata
  });

  describe('detectPatternsAndEntryPoints', () => {
    it('should be defined', () => {
      // @ts-expect-error // Accessing private method for testing
      expect(scannerService.detectPatternsAndEntryPoints).toBeDefined();
    });
    // Add more tests for detectPatternsAndEntryPoints
  });
}); 