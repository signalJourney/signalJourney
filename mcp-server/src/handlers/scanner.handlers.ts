import { z } from 'zod';
import { RequestHandlerExtra, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

// Import the class, not the default
import { RepositoryScannerService, TraversalOptions, TraversedFile } from '@/services/repositoryScanner.service';
import { McpExecutionContext, CallToolResult, McpApplicationError } from '@/core/mcp-types';
import { AuthPayload } from '@/middleware/auth.middleware';
import logger from '@/utils/logger';
import { ScanRepositoryParams } from '@/schemas/scanner.schemas';

// Define Zod Schema for the tool parameters
export const scanRepositoryParamsSchema = z.object({
  repoPath: z.string().min(1).describe('The local file system path to the repository to scan.'),
  excludePatterns: z.array(z.string()).optional().describe('Glob patterns for exclusion (relative to repoPath).'),
  maxDepth: z.number().int().positive().optional().describe('Maximum directory traversal depth.'),
  followSymlinks: z.boolean().optional().default(false).describe('Whether to follow symbolic links.'),
  parseCode: z.boolean().optional().default(true).describe('Whether to perform basic code structure parsing.'),
});

// Infer TypeScript type from the Zod schema
export type ScanRepositoryParams = z.infer<typeof scanRepositoryParamsSchema>;

// Instantiate the service
const repositoryScannerService = new RepositoryScannerService();

// MCP Tool Handler function
export async function handleScanRepository(
  args: ScanRepositoryParams,
  extra: RequestHandlerExtra
): Promise<CallToolResult> {
  const scanId = extra.requestId || `scan-${Date.now()}`;
  logger.info(`[${scanId}] Received scan_repository request`, { repoPath: args.repoPath });

  try {
    const scanOptions: TraversalOptions = {
      excludePatterns: args.excludePatterns,
      maxDepth: args.maxDepth,
      followSymlinks: args.followSymlinks,
      parseCode: args.parseCode,
    };

    const startTime = Date.now();
    // Use the instantiated service
    const files = await repositoryScannerService.scanRepository(args.repoPath, scanOptions);
    const scanDuration = Date.now() - startTime;

    logger.info(`[${scanId}] Scan completed in ${scanDuration}ms. Found ${files.length} items.`);

    // Persist results (optional, depends on if persistence service is ready/refactored)
    // try {
    //   await scanPersistenceService.saveScanResult(
    //     scanId,
    //     args.repoPath,
    //     scanOptions,
    //     files,
    //     scanDuration
    //   );
    //   logger.info(`[${scanId}] Scan results persisted.`);
    // } catch (persistError: any) {
    //   logger.error(`[${scanId}] Failed to persist scan results: ${persistError.message}`);
    //   // Decide if this should cause the tool to fail
    // }

    // Limit the response size if necessary
    const maxResponseItems = 1000; // Example limit
    const limitedFiles = files.slice(0, maxResponseItems);

    return {
      status: 'success',
      content: [{ type: 'json', data: { scanId, count: files.length, durationMs: scanDuration, items: limitedFiles } }]
    };
  } catch (error: any) {
    logger.error(`[${scanId}] Repository scan failed: ${error.message}`, { stack: error.stack });
    if (error instanceof McpApplicationError) {
      return {
        status: 'error',
        error: {
          message: error.message,
          code: error.code || 'SCAN_ERROR',
          details: error.details,
        },
      };
    }

    // For unexpected errors
    return {
      status: 'error',
      error: {
        message: 'Failed to scan repository due to an unexpected error.',
        code: 'SCAN_UNEXPECTED_ERROR',
      },
    };
  }
} 