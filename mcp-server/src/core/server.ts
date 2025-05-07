import { McpServer, McpServerToolValidationError } from '@modelcontextprotocol/sdk';
import { ZodError } from 'zod';
import config from '@/config';
import logger from '@/utils/logger';
import {
  GetServerStatusArgsSchema,
  GetServerVersionArgsSchema,
  handleGetServerStatus,
  handleGetServerVersion,
} from '@/handlers/system.handlers';
import { McpExecutionContext, McpApplicationError } from '@/core/mcp-types';
import { randomUUID } from 'crypto'; // For generating requestId

let mcpServerInstance: McpServer;

export function initializeMcpServer(): McpServer {
  if (mcpServerInstance) {
    logger.warn('MCP Server already initialized.');
    return mcpServerInstance;
  }

  mcpServerInstance = new McpServer({
    name: config.server.mcpServerName,
    version: config.server.mcpServerVersion,
    description: 'MCP Server for SignalJourney Pipeline Analysis',
    // TODO: Update this URL to the actual documentation URL once available
    documentationUrl: 'https://github.com/neuromechanist/signalJourney/docs/mcp-server',
    // Define capabilities as needed, e.g., tools, resources, prompts
    capabilities: {
      tools: true, // Indicates that the server will register tools
      resources: true, // Indicates that the server will register resources
      prompts: false, // Set to true if prompts will be registered
      // TODO: Add more specific capability declarations as features are implemented
    },
    // Custom error serialization to ensure our McpApplicationError details are included
    serializeError: (err: Error) => {
      if (err instanceof McpApplicationError) {
        return {
          code: err.code,
          message: err.message,
          details: err.details,
        };
      }
      if (err instanceof McpServerToolValidationError) {
        // The SDK's validation error already has a good structure
        return {
            code: 'VALIDATION_ERROR',
            message: err.message,            
            details: err.issues.map(issue => ({ 
                path: issue.path,
                message: issue.message,
                code: issue.code, 
            })),
        };
      }
      // Fallback for generic errors
      return {
        code: 'INTERNAL_ERROR',
        message: err.message || 'An unexpected error occurred.',
        // stack: config.server.nodeEnv === 'development' ? err.stack : undefined, // Optionally include stack
      };
    },
  });

  logger.info(
    `MCP Server initialized: ${config.server.mcpServerName} v${config.server.mcpServerVersion}`
  );

  // Register system tools
  mcpServerInstance.tool('get_server_status', {
    description: 'Returns the current status, name, version, and timestamp of the server.',
    paramSchema: GetServerStatusArgsSchema,
    execute: async (args, sdkContext) => {
      // Create our McpExecutionContext
      const executionContext: McpExecutionContext = {
        requestId: sdkContext.requestId || randomUUID(), // Use SDK requestId or generate one
        logger: logger.child({ requestId: sdkContext.requestId || 'unknown' }),
        // auth: sdkContext.auth, // Pass along auth context from SDK if available and needed
      };
      return handleGetServerStatus(args, executionContext);
    },
  });
  logger.info('Registered tool: get_server_status');

  mcpServerInstance.tool('get_server_version', {
    description: 'Returns the name and version of the server.',
    paramSchema: GetServerVersionArgsSchema,
    execute: async (args, sdkContext) => {
      const executionContext: McpExecutionContext = {
        requestId: sdkContext.requestId || randomUUID(),
        logger: logger.child({ requestId: sdkContext.requestId || 'unknown' }),
      };
      return handleGetServerVersion(args, executionContext);
    },
  });
  logger.info('Registered tool: get_server_version');
  
  // TODO: Register other tools as they are developed

  return mcpServerInstance;
}

export function getMcpServer(): McpServer {
  if (!mcpServerInstance) {
    logger.error('MCP Server has not been initialized. Call initializeMcpServer() first.');
    process.exit(1);
    // throw new Error('MCP Server has not been initialized. Call initializeMcpServer() first.');
  }
  return mcpServerInstance;
} 