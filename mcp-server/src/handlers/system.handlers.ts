import { randomUUID } from 'crypto';

import { z } from 'zod';
import { CallToolResult, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

import config from '@/config';
import { McpExecutionContext, McpApplicationError } from '@/core/mcp-types';
import logger from '@/utils/logger';
import { AuthPayload } from '@/middleware/auth.middleware'; // To cast extra.authInfo

// Schema for get_server_status (no arguments)
export const GetServerStatusParamsSchema = z.object({});
export type GetServerStatusParams = z.infer<typeof GetServerStatusParamsSchema>;

export interface ServerStatus {
  status: string;
  timestamp: string;
  serviceName: string;
  version: string;
  uptime: number;
  nodeVersion: string;
  platform: string;
  memoryUsage: NodeJS.MemoryUsage;
  // Potentially add checks for DB connection, other critical services
}

/**
 * Handles the 'get_server_status' MCP tool.
 * Returns the current status, name, version, and timestamp of the server.
 */
export async function handleGetServerStatus(
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
): Promise<CallToolResult> {
  const mcpContext: McpExecutionContext = {
    requestId: extra.requestId.toString(), // RequestId can be string | number
    logger: logger.child({ requestId: extra.requestId.toString() }),
    authInfo: extra.authInfo as AuthPayload | undefined, // Cast SDK AuthInfo if needed, or map it
  };
  mcpContext.logger.info('Handling getServerStatus');
  const status: ServerStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    serviceName: config.server.mcpServerName,
    version: config.server.mcpServerVersion,
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: process.platform,
    memoryUsage: process.memoryUsage(),
  };
  return { content: [{ type: 'text', text: JSON.stringify(status) }] };
}

// Schema for get_server_version (no arguments)
export const GetServerVersionParamsSchema = z.object({});
export type GetServerVersionParams = z.infer<typeof GetServerVersionParamsSchema>;

export interface ServerVersion {
  serviceName: string;
  version: string;
  protocolVersion?: string; 
}

/**
 * Handles the 'get_server_version' MCP tool.
 * Returns the name and version of the server.
 */
export async function handleGetServerVersion(
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
): Promise<CallToolResult> {
  const mcpContext: McpExecutionContext = {
    requestId: extra.requestId.toString(),
    logger: logger.child({ requestId: extra.requestId.toString() }),
    authInfo: extra.authInfo as AuthPayload | undefined,
  };
  mcpContext.logger.info('Handling getServerVersion');
  const versionInfo: ServerVersion = {
    serviceName: config.server.mcpServerName,
    version: config.server.mcpServerVersion,
  };
  if (typeof extra._meta?.protocolVersion === 'string') {
    versionInfo.protocolVersion = extra._meta.protocolVersion;
  }
  return { content: [{ type: 'text', text: JSON.stringify(versionInfo) }] };
} 