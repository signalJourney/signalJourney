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

  // --- Register System Tools ---
  mcpServerInstance.tool(
    'system.getServerStatus',
    'Get the current status of the MCP server.',
    handleGetServerStatus
  );

  mcpServerInstance.tool(
    'system.getServerVersion',
    'Get the version of the MCP server.',
    handleGetServerVersion
  );

  // --- Register Resource Management Tools ---
  const resourceWriteAnnotations: ToolAnnotations = { requiredScopes: ['write:resource'] };
  const resourceReadAnnotations: ToolAnnotations = { requiredScopes: ['read:resource'] };

  mcpServerInstance.tool(
    'resource.create',
    'Create a new resource.',
    CreateResourceParamsSchema.shape,
    resourceWriteAnnotations,
    handleCreateResource
  );

  mcpServerInstance.tool(
    'resource.get',
    'Get a resource by its ID.',
    GetResourceParamsSchema.shape,
    resourceReadAnnotations,
    handleGetResource
  );

  mcpServerInstance.tool(
    'resource.update',
    'Update an existing resource.',
    UpdateResourceParamsSchema.shape,
    resourceWriteAnnotations,
    handleUpdateResource
  );

  mcpServerInstance.tool(
    'resource.delete',
    'Delete a resource by its ID.',
    DeleteResourceParamsSchema.shape,
    resourceWriteAnnotations,
    handleDeleteResource
  );

  mcpServerInstance.tool(
    'resource.list',
    'List resources, optionally filtered by type (owned by the authenticated user).',
    ListResourcesParamsSchema.shape,
    resourceReadAnnotations,
    handleListResources
  );

  logger.info('All MCP tools registered.');
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