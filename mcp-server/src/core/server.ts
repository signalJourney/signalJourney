import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import { ToolAnnotations, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import config from '@/config';
import logger from '@/utils/logger';
import {
  handleGetServerStatus,
  handleGetServerVersion,
  GetServerStatusParamsSchema,
  GetServerVersionParamsSchema
} from '@/handlers/system.handlers';
import { McpApplicationError, McpErrorPayload } from '@/core/mcp-types';
import {
  handleCreateResource, CreateResourceParamsSchema,
  handleGetResource, GetResourceParamsSchema,
  handleUpdateResource, UpdateResourceParamsSchema,
  handleDeleteResource, DeleteResourceParamsSchema,
  handleListResources, ListResourcesParamsSchema
} from '@/handlers/resource.handlers';
import {
  handleScanRepository,
  scanRepositoryParamsSchema
} from '@/handlers/scanner.handlers';

let mcpServerInstance: McpServer;

// Custom error serializer for MCP Server
const serializeError = (error: any): McpErrorPayload => {
  if (error instanceof McpApplicationError) {
    return { code: error.code, message: error.message, details: error.details };
  }
  if (error instanceof Error) {
    return { code: 'UNHANDLED_TOOL_ERROR', message: error.message };
  }
  return { code: 'UNKNOWN_TOOL_ERROR', message: 'An unknown error occurred in the tool' };
};

export async function initializeMcpServer(): Promise<McpServer> {
  if (mcpServerInstance) {
    logger.warn('MCP Server already initialized.');
    return mcpServerInstance;
  }

  mcpServerInstance = new McpServer(
    {
      name: config.server.mcpServerName,
      version: config.server.mcpServerVersion,
    },
    {
      logger: logger,
      serializeError: serializeError,
    } as ServerOptions
  );

  logger.info('MCP Server instance created.');

  logger.info('Registering MCP tools...');

  // --- Register System Tools ---
  mcpServerInstance.tool('get_server_status', 'Get server health and status.', handleGetServerStatus);
  mcpServerInstance.tool('get_server_version', 'Get server version information.', handleGetServerVersion);

  // --- Register Resource Tools ---
  const resourceAnnotations: ToolAnnotations = { category: 'resource_management' };
  mcpServerInstance.tool('create_resource', 'Create a new generic resource.', CreateResourceParamsSchema.shape, resourceAnnotations, handleCreateResource);
  mcpServerInstance.tool('get_resource', 'Retrieve a resource by its ID.', GetResourceParamsSchema.shape, resourceAnnotations, handleGetResource);
  mcpServerInstance.tool('update_resource', 'Update an existing resource.', UpdateResourceParamsSchema.shape, resourceAnnotations, handleUpdateResource);
  mcpServerInstance.tool('delete_resource', 'Delete a resource by its ID.', DeleteResourceParamsSchema.shape, resourceAnnotations, handleDeleteResource);
  mcpServerInstance.tool('list_resources', 'List available resources, optionally filtering by type.', ListResourcesParamsSchema.shape, resourceAnnotations, handleListResources);

  // --- Register Scanner Tool ---
  const scannerAnnotations: ToolAnnotations = { category: 'repository_analysis' };
  mcpServerInstance.tool(
    'scan_repository', 
    'Scans a local repository directory, returning structured file information.',
    scanRepositoryParamsSchema.shape, 
    scannerAnnotations, 
    handleScanRepository
  );

  logger.info('MCP tools registered successfully.');
  return mcpServerInstance;
}

// Custom Execution Context Builder
// This function is called by the McpServer before each tool execution.
// It allows you to enrich the context passed to your tool handlers.
// McpServer.prototype.buildExecutionContext = function (
//     rawContext?: Partial<AuthenticationContext>
// ): McpExecutionContext {
//     const requestId = (rawContext?.http?.res?.locals?.requestId) || randomUUID(); 
//     const authInfo = rawContext?.auth as AuthPayload | undefined;

//     logger.debug('Building execution context', { requestId, userId: authInfo?.userId });

//     // Basic context provided by SDK (like rawContext.auth)
//     // Plus, anything custom you want to add, like a transaction ID, specific user permissions, etc.
//     return {
//         requestId,
//         authInfo,
//         // dbClient: getDbClient(), // Example: if you want to pass a db client to tools
//     };
// };

export function getMcpServer(): McpServer {
  if (!mcpServerInstance) {
    logger.error('MCP Server has not been initialized. Call initializeMcpServer first.');
    process.exit(1);
    // throw new Error('MCP Server has not been initialized. Call initializeMcpServer first.');
  }
  return mcpServerInstance;
} 