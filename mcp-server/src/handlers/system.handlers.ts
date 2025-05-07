import { ZodObject, ZodSchema, z } from 'zod';
import config from '@/config';
import { McpExecutionContext, McpToolOutput, McpApplicationError } from '@/core/mcp-types';
import logger from '@/utils/logger';

// Schema for get_server_status (no arguments)
export const GetServerStatusArgsSchema = z.object({});
export type GetServerStatusArgs = z.infer<typeof GetServerStatusArgsSchema>;

export interface ServerStatus {
  status: string;
  name: string;
  version: string;
  timestamp: string;
  nodeEnv: string;
  logLevel: string;
}

/**
 * Handles the 'get_server_status' MCP tool.
 * Returns the current status, name, version, and timestamp of the server.
 */
export async function handleGetServerStatus(
  args: GetServerStatusArgs, // Validated by McpServer.tool() if schema is provided
  context: McpExecutionContext
): Promise<ServerStatus> { // SDK expects the raw result or an error to be thrown
  context.logger.info(`Executing get_server_status with requestId: ${context.requestId}`);
  try {
    return {
      status: 'running',
      name: config.server.mcpServerName,
      version: config.server.mcpServerVersion,
      timestamp: new Date().toISOString(),
      nodeEnv: config.server.nodeEnv,
      logLevel: config.logging.level,
    };
  } catch (error) {
    context.logger.error('Error in handleGetServerStatus:', error);
    // Let the McpServer handle formatting this into an MCP error response
    throw new McpApplicationError(
      'Failed to get server status',
      'GET_STATUS_FAILED',
      error instanceof Error ? error.message : undefined
    );
  }
}

// Schema for get_server_version (no arguments)
export const GetServerVersionArgsSchema = z.object({});
export type GetServerVersionArgs = z.infer<typeof GetServerVersionArgsSchema>;

export interface ServerVersion {
  name: string;
  version: string;
}

/**
 * Handles the 'get_server_version' MCP tool.
 * Returns the name and version of the server.
 */
export async function handleGetServerVersion(
  args: GetServerVersionArgs,
  context: McpExecutionContext
): Promise<ServerVersion> {
  context.logger.info(`Executing get_server_version with requestId: ${context.requestId}`);
  try {
    return {
      name: config.server.mcpServerName,
      version: config.server.mcpServerVersion,
    };
  } catch (error) {
    context.logger.error('Error in handleGetServerVersion:', error);
    throw new McpApplicationError(
      'Failed to get server version',
      'GET_VERSION_FAILED',
      error instanceof Error ? error.message : undefined
    );
  }
} 