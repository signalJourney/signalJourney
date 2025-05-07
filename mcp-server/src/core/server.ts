import { McpServer, AuthenticationContext, McpServerTool } from '@modelcontextprotocol/sdk';
import { ZodError } from 'zod';
import config from '@/config';
import logger from '@/utils/logger';
import {
  GetServerStatusArgsSchema,
  GetServerVersionArgsSchema,
  handleGetServerStatus,
  handleGetServerVersion,
  GetServerStatusParamsSchema,
  GetServerVersionParamsSchema
} from '@/handlers/system.handlers';
import { McpExecutionContext, McpApplicationError, McpErrorPayload } from '@/core/mcp-types';
import { randomUUID } from 'crypto'; // For generating requestId
import {
  handleCreateResource, CreateResourceParamsSchema,
  handleGetResource, GetResourceParamsSchema,
  handleUpdateResource, UpdateResourceParamsSchema,
  handleDeleteResource, DeleteResourceParamsSchema,
  handleListResources, ListResourcesParamsSchema
} from '@/handlers/resource.handlers';
import { AuthPayload } from '@/middleware/auth.middleware'; // For casting authInfo

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

  mcpServerInstance = new McpServer({
    serverName: config.server.mcpServerName,
    serverVersion: config.server.mcpServerVersion,
    logger: logger, // Use your Winston logger instance
    serializeError: serializeError, // Register custom error serializer
    // executionContextBuilder: buildExecutionContext // Register custom context builder
  });

  logger.info('MCP Server instance created.');

  // --- Register System Tools ---
  mcpServerInstance.tool('system.getServerStatus', {
    description: 'Get the current status of the MCP server.',
    handler: handleGetServerStatus,
    paramSchema: GetServerStatusParamsSchema, // Zod schema for params
  });

  mcpServerInstance.tool('system.getServerVersion', {
    description: 'Get the version of the MCP server.',
    handler: handleGetServerVersion,
    paramSchema: GetServerVersionParamsSchema,
  });

  // --- Register Resource Management Tools ---
  mcpServerInstance.tool('resource.create', {
    description: 'Create a new resource.',
    handler: handleCreateResource,
    paramSchema: CreateResourceParamsSchema,
    requiredScopes: ['write:resource'] // Example scope requirement
  });

  mcpServerInstance.tool('resource.get', {
    description: 'Get a resource by its ID.',
    handler: handleGetResource,
    paramSchema: GetResourceParamsSchema,
    requiredScopes: ['read:resource']
  });

  mcpServerInstance.tool('resource.update', {
    description: 'Update an existing resource.',
    handler: handleUpdateResource,
    paramSchema: UpdateResourceParamsSchema,
    requiredScopes: ['write:resource']
  });

  mcpServerInstance.tool('resource.delete', {
    description: 'Delete a resource by its ID.',
    handler: handleDeleteResource,
    paramSchema: DeleteResourceParamsSchema,
    requiredScopes: ['write:resource'] // Or a more specific 'delete:resource'
  });

  mcpServerInstance.tool('resource.list', {
    description: 'List resources, optionally filtered by type (owned by the authenticated user).'
    handler: handleListResources,
    paramSchema: ListResourcesParamsSchema,
    requiredScopes: ['read:resource']
  });

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