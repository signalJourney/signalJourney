import { z } from 'zod';
import repositoryScannerService, { TraversalOptions, TraversedFile } from '@/services/repositoryScanner.service';
import scanPersistenceService from '@/services/scanPersistence.service';
import { McpExecutionContext, CallToolResult, McpApplicationError } from '@/core/mcp-types';
import { RequestHandlerExtra, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { AuthPayload } from '@/middleware/auth.middleware';
import logger from '@/utils/logger';

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

// MCP Tool Handler function
export async function handleScanRepository(
  args: ScanRepositoryParams,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
): Promise<CallToolResult> {
  const mcpContext: McpExecutionContext = {
    requestId: extra.requestId.toString(),
    logger: logger.child({ requestId: extra.requestId.toString(), tool: 'scan_repository' }),
    authInfo: extra.authInfo as AuthPayload | undefined,
  };

  mcpContext.logger.info(`Initiating repository scan for path: ${args.repoPath}`);

  try {
    // Prepare options for the service
    const options: TraversalOptions = {
      excludePatterns: args.excludePatterns,
      maxDepth: args.maxDepth,
      followSymlinks: args.followSymlinks,
      parseCode: args.parseCode,
    };

    const result: TraversedFile[] = await repositoryScannerService.scanRepository(args.repoPath, options);

    mcpContext.logger.info(`Scan completed. Found ${result.length} files.`);

    // Save the result to the database asynchronously (don't wait for it)
    scanPersistenceService.saveScanResult(args.repoPath, options, result)
      .then(scanId => mcpContext.logger.info(`Scan result saved with ID: ${scanId}`))
      .catch(err => mcpContext.logger.error(`Failed to save scan result asynchronously: ${err.message}`));

    // Return successful result immediately
    return {
      content: [{ type: 'json', data: result }]
    };

  } catch (error: any) {
    mcpContext.logger.error(`Repository scan failed: ${error.message}`, { error });
    
    // Handle known application errors specifically
    if (error instanceof McpApplicationError) {
      return {
        error: {
          code: error.code || 'SCAN_FAILED',
          message: error.message,
          data: error.details,
        }
      };
    }

    // Handle generic errors
    return {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: `An unexpected error occurred during repository scan: ${error.message}`,
      }
    };
  }
} 