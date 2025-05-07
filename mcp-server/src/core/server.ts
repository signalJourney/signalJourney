import { McpServer, McpServerOptions } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/types.js';
// eslint-disable-next-line import/no-unresolved
// import { McpServer, McpServerOptions, Transport } from '@modelcontextprotocol/sdk';

import { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { getLogger } from '@/utils/logger';
import {
  handleGetStatus,
  handleGetVersion,
} from '@/handlers/system.handlers';
import {
  handleCreateResource,
  handleGetResource,
  handleUpdateResource,
  handleDeleteResource,
  // handleListResources, // Assuming ListResources is not yet implemented or needed based on previous handlers
} from '@/handlers/resource.handlers';
import { handleScanRepository } from '@/handlers/scanner.handlers';
import { McpApplicationError, McpErrorPayload } from '@/core/mcp-types';

let mcpServerInstance: McpServer<AuthenticatedRequest> | null = null;

/**
 * Creates and configures an McpServer instance with specified tools and options.
 * This function is the primary way to instantiate the server, ensuring all tools
 * and error handling are set up correctly via constructor options.
 *
 * @param options Optional partial configuration for McpServer, useful for testing or custom setups.
 * @returns The newly created McpServer instance.
 */
export function createMcpServer(options?: Partial<McpServerOptions<AuthenticatedRequest>>): McpServer<AuthenticatedRequest> {
  const logger = getLogger('McpServerCore');
  logger.info('Creating MCP Server instance via createMcpServer...');

  const defaultOptions: McpServerOptions<AuthenticatedRequest> = {
    logger: getLogger('MCP_SDK_Server'), // Logger for the SDK itself
    // Defines all tools available on the server.
    // Each tool has a name (e.g., 'namespace.method'), a description,
    // the handler function, and can optionally include input/output schemas (e.g., Zod schemas).
    tools: [
      // System Tools
      {
        name: 'system.getStatus',
        description: 'Get the operational status of the MCP server.',
        handler: handleGetStatus,
      },
      {
        name: 'system.getVersion',
        description: 'Get the version of the MCP server application.',
        handler: handleGetVersion,
      },
      // Resource Management Tools
      {
        name: 'resource.create',
        description: 'Create a new resource.',
        handler: handleCreateResource,
      },
      {
        name: 'resource.get',
        description: 'Get a resource by its ID.',
        handler: handleGetResource,
      },
      {
        name: 'resource.update',
        description: 'Update an existing resource by its ID.',
        handler: handleUpdateResource,
      },
      {
        name: 'resource.delete',
        description: 'Delete a resource by its ID.',
        handler: handleDeleteResource,
      },
      // Potentially: handleListResources if it was defined and imported
      // {
      //   name: 'resource.list',
      //   description: 'List available resources.',
      //   handler: handleListResources,
      // },
      // Scanner Tools
      {
        name: 'scanner.scanRepository',
        description: 'Scans a repository based on provided path and options, returning structured data about its contents.',
        handler: handleScanRepository,
      }
    ],
    // Custom error serialization to ensure McpApplicationError details are propagated correctly.
    serializeError: (err: any): McpErrorPayload => {
      if (err instanceof McpApplicationError) {
        return err.toJson(); // Uses the custom toJson method of McpApplicationError
      }
      // Default error serialization for unexpected errors
      const defaultErrorPayload: McpErrorPayload = {
        code: -32000, // Generic server error code based on JSON-RPC spec
        message: 'An unexpected error occurred on the server.',
      };
      if (err instanceof Error) {
        defaultErrorPayload.message = err.message; // Prefer specific error message if available
        // Include stack trace in non-production environments for easier debugging.
        if (process.env.NODE_ENV !== 'production' && err.stack) {
          defaultErrorPayload.data = { stack: err.stack, originalErrorType: err.constructor.name };
        }
      }
      logger.error('Unhandled error in McpServer, serialized to default error format:', { originalError: err });
      return defaultErrorPayload;
    },
    // Other McpServerOptions can be added here if needed (e.g., custom buildExecutionContext)
  };

  // Merge default options with any custom options passed to the function.
  // This allows overriding defaults for specific use cases (e.g., testing).
  const serverOptions = { ...defaultOptions, ...options };

  const serverInstance = new McpServer<AuthenticatedRequest>(serverOptions);
  logger.info('MCP Server instance created successfully with configured tools and error serialization.');

  return serverInstance;
}

/**
 * Retrieves the singleton McpServer instance. If it doesn\'t already exist,
 * it creates one using `createMcpServer` with default options.
 * This ensures that the same server instance is used throughout the application.
 *
 * @param transport Optional transport to attach if creating the server for the first time.
 *                  This is useful for immediately making the server available via a specific transport.
 * @returns The singleton McpServer instance.
 */
export function getMcpServer(transport?: Transport<AuthenticatedRequest>): McpServer<AuthenticatedRequest> {
  const logger = getLogger('McpServerSingleton');
  if (!mcpServerInstance) {
    logger.info('Singleton McpServer instance not found, creating a new one...');
    mcpServerInstance = createMcpServer(); // Create with default options
    logger.info('Singleton McpServer instance created.');
    if (transport) {
      mcpServerInstance.addTransport(transport);
      logger.info(`Initial transport of type '${transport.constructor.name}' attached to new McpServer instance.`);
    }
  } else {
    logger.debug('Returning existing singleton McpServer instance.');
  }
  return mcpServerInstance;
}

/**
 * Utility function to initialize the McpServer (ensuring it\'s created via getMcpServer)
 * and attach multiple transports to it.
 *
 * @param transports An array of transports to attach to the server.
 */
export function initializeMcpServerWithTransports(transports: Transport<AuthenticatedRequest>[]) {
    const server = getMcpServer(); // Ensures server is created if it doesn't exist.
    const logger = getLogger('McpServerInit');
    logger.info(`Initializing McpServer with ${transports.length} transport(s)...`);
    transports.forEach(transportToAttach => {
        server.addTransport(transportToAttach);
        logger.info(`Transport of type '${transportToAttach.constructor.name}' attached.`);
    });
    logger.info('All provided transports attached to McpServer.');
} 