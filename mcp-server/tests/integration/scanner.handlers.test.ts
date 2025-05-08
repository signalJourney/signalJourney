import { handleScanRepository } from '../../src/handlers/scanner.handlers';
import { RepositoryScannerService } from '../../src/services/repositoryScanner.service';
import scanPersistenceService from '../../src/services/scanPersistence.service';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { 
  RequestHandlerExtra, 
} from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ZodError } from 'zod';
import { ScanRepositoryParams } from '../../src/handlers/scanner.handlers';
import { McpExecutionContext } from '../../src/core/mcp-types';

// Mock the service modules. Jest replaces the actual module with a mock constructor
// and automatically mocks its methods.
jest.mock('../../src/services/repositoryScanner.service');
jest.mock('../../src/services/scanPersistence.service');
jest.mock('../../src/utils/logger'); // Mock logger if used directly in handler

// Get a reference to the *mocked* constructor provided by jest.mock
const MockRepositoryScannerService = RepositoryScannerService as jest.MockedClass<typeof RepositoryScannerService>;

describe('Scanner Handlers', () => {
  // No need to instantiate mocks in beforeEach unless setting specific return values

  beforeEach(() => {
    jest.clearAllMocks();
    // If you need to reset the mock implementation between tests:
    MockRepositoryScannerService.mockClear(); 
    // You can access the mock instance created inside the handler via MockRepositoryScannerService.mock.instances[0]
  });

  describe('handleScanRepository', () => {
    const mockExtra: Partial<McpExecutionContext> = {
      requestId: 'test-req-123',
    };

    it('should call the mocked repositoryScannerService.scanRepository', async () => {
      const args: ScanRepositoryParams = {
        repoPath: '/path/to/scan',
        excludePatterns: ['node_modules'],
        followSymlinks: false,
        parseCode: true
      };
      const mockScanResult = [{ path: 'file.ts', relativePath: 'file.ts', name: 'file.ts', ext: '.ts', depth: 0 }];

      // Since the service is instantiated *inside* the handler, we need to mock the constructor
      // or its prototype methods *before* the handler is called.
      // Mocking the prototype is often easier:
      const mockScanMethod = jest.fn().mockResolvedValue(mockScanResult);
      MockRepositoryScannerService.prototype.scanRepository = mockScanMethod;

      await handleScanRepository(args, mockExtra as any);

      // Assert that the mock method on the prototype was called
      expect(mockScanMethod).toHaveBeenCalledWith(
        args.repoPath,
        expect.objectContaining({
          excludePatterns: args.excludePatterns,
        })
      );
      // Optionally check the number of instances created if needed
      expect(MockRepositoryScannerService).toHaveBeenCalledTimes(1);
    });

    // Add more tests: error handling, persistence call, etc.
  });
}); 