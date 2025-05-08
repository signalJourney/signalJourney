import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
// eslint-disable-next-line import/no-unresolved
// import { McpServer, McpServerOptions, Transport } from '@modelcontextprotocol/sdk';

import { AuthenticatedRequest } from '@/middleware/auth.middleware';
// Import the default logger instance
import logger from '@/utils/logger';
// Import handlers directly since the system handlers may not be available yet
// We'll define mockups for these handlers that can be replaced later
import { McpApplicationError } from '@/core/mcp-types';

// Mock handlers until actual handlers are implemented
const handleGetStatus = async () => {
  return {
    content: [{ 
      type: "text" as const, 
      text: JSON.stringify({ status: 'operational', serverTime: new Date().toISOString() }) 
    }]
  };
};

const handleGetVersion = async () => {
  return {
    content: [{ 
      type: "text" as const, 
      text: JSON.stringify({ name: 'SignalJourney MCP Server', version: '0.1.0' }) 
    }]
  };
};

// Placeholder handlers for resources
const handleCreateResource = async () => {
  return {
    content: [{ type: "text" as const, text: 'Resource created' }]
  };
};

const handleGetResource = async () => {
  return {
    content: [{ type: "text" as const, text: 'Resource retrieved' }]
  };
};

const handleUpdateResource = async () => {
  return {
    content: [{ type: "text" as const, text: 'Resource updated' }]
  };
};

const handleDeleteResource = async () => {
  return {
    content: [{ type: "text" as const, text: 'Resource deleted' }]
  };
};

const handleScanRepository = async () => {
  return {
    content: [{ type: "text" as const, text: 'Repository scanned' }]
  };
};

let mcpServerInstance: McpServer | null = null;

/**
 * Creates and configures an McpServer instance with specified tools and options.
 * This function is the primary way to instantiate the server, ensuring all tools
 * and error handling are set up correctly via constructor options.
 *
 * @param options Optional partial configuration for McpServer, useful for testing or custom setups.
 * @returns The newly created McpServer instance.
 */
export function createMcpServer(options?: any): McpServer {
  const coreLogger = logger.child({ service: 'McpServerCore' });
  coreLogger.info('Creating MCP Server instance via createMcpServer...');

  // Create the McpServer with the implementation info
  const serverInstance = new McpServer({
    name: 'SignalJourney MCP Server',
    version: '0.1.0'
  }, {
    ...(options || {}),
    // We'll register each handler with the server after creation
    serializeError: (err: any): { code: number, message: string, data?: any } => {
      if (err instanceof McpApplicationError) {
        return {
          code: typeof err.code === 'number' ? err.code : -32000, // Ensure we return a number
          message: err.message,
          data: err.details
        };
      }
      const defaultErrorPayload = {
        code: -32000,
        message: 'An unexpected error occurred on the server.',
        data: undefined as any
      };
      if (err instanceof Error) {
        defaultErrorPayload.message = err.message;
        if (process.env.NODE_ENV !== 'production' && err.stack) {
          defaultErrorPayload.data = { stack: err.stack, originalErrorType: err.constructor.name };
        }
      }
      logger.error('Unhandled error in McpServer...', { originalError: err });
      return defaultErrorPayload;
    }
  });
  
  // Register each tool directly
  serverInstance.tool('system.getStatus', handleGetStatus);
  serverInstance.tool('system.getVersion', handleGetVersion);
  serverInstance.tool('resource.create', handleCreateResource);
  serverInstance.tool('resource.get', handleGetResource);
  serverInstance.tool('resource.update', handleUpdateResource);
  serverInstance.tool('resource.delete', handleDeleteResource);
  serverInstance.tool('scanner.scanRepository', handleScanRepository);
  
  coreLogger.info('MCP Server instance created successfully...');

  return serverInstance;
}

/**
 * Retrieves the singleton McpServer instance. If it doesn't already exist,
 * it creates one using `createMcpServer` with default options.
 * This ensures that the same server instance is used throughout the application.
 *
 * @param transport Optional transport to attach if creating the server for the first time.
 *                  This is useful for immediately making the server available via a specific transport.
 * @returns The singleton McpServer instance.
 */
export function getMcpServer(transport?: Transport): McpServer {
  const singletonLogger = logger.child({ service: 'McpServerSingleton' });
  if (!mcpServerInstance) {
    singletonLogger.info('Singleton McpServer instance not found, creating...');
    mcpServerInstance = createMcpServer();
    singletonLogger.info('Singleton McpServer instance created.');
    if (transport) {
      mcpServerInstance.connect(transport);
      singletonLogger.info(`Initial transport attached to new McpServer instance.`);
    }
  } else {
    singletonLogger.debug('Returning existing singleton McpServer instance.');
  }
  return mcpServerInstance;
}

/**
 * Utility function to initialize the McpServer (ensuring it's created via getMcpServer)
 * and attach multiple transports to it.
 *
 * @param transports An array of transports to attach to the server.
 */
export async function initializeMcpServerWithTransports(transports: Transport[]) {
  const server = getMcpServer();
  const initLogger = logger.child({ service: 'McpServerInit' });
  initLogger.info(`Initializing McpServer with ${transports.length} transport(s)...`);
  for (const transportToAttach of transports) {
    await server.connect(transportToAttach);
    initLogger.info(`Transport of type '${transportToAttach.constructor.name}' attached.`);
  }
  initLogger.info('All provided transports attached to McpServer.');
}