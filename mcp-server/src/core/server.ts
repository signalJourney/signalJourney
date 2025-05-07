import { McpServer } from '@modelcontextprotocol/sdk';
import config from '@/config';
import logger from '@/utils/logger';

let mcpServer: McpServer;

export function initializeMcpServer(): McpServer {
  if (mcpServer) {
    logger.warn('MCP Server already initialized.');
    return mcpServer;
  }

  mcpServer = new McpServer({
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
  });

  logger.info(
    `MCP Server initialized: ${config.server.mcpServerName} v${config.server.mcpServerVersion}`
  );

  // TODO: Register actual tools, resources, and prompts here as they are developed
  // Example of registering a simple tool:
  /*
  mcpServer.tool('get_server_status', {
    description: 'Returns the current status of the MCP server',
    paramSchema: z.object({}), // No parameters
    execute: async () => {
      return {
        status: 'running',
        timestamp: new Date().toISOString(),
        serverName: config.server.mcpServerName,
        serverVersion: config.server.mcpServerVersion,
      };
    },
  });
  logger.info('Registered tool: get_server_status');
  */

  return mcpServer;
}

export function getMcpServer(): McpServer {
  if (!mcpServer) {
    logger.error('MCP Server has not been initialized. Call initializeMcpServer() first.');
    process.exit(1);
    // throw new Error('MCP Server has not been initialized. Call initializeMcpServer() first.');
  }
  return mcpServer;
} 