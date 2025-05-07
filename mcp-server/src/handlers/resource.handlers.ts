// eslint-disable-next-line import/no-unresolved
import { McpRequest, McpResponse, ToolContext } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

import { McpExecutionContext, McpApplicationError, CallToolResult } from '@/core/mcp-types';
import { ResourceService } from '@/services/resource.service';
import { AuthPayload } from '@/middleware/auth.middleware';
import logger from '@/utils/logger';
import { Resource } from '@/models/resource.model';

// --- Zod Schemas for Tool Parameters ---

const createResourceParamsSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Resource name cannot be empty."),
  type: z.string().min(1, "Resource type cannot be empty."),
  data: z.record(z.any()),
  metadata: z.record(z.any()).optional(),
});

const getResourceParamsSchema = z.object({
  id: z.string().min(1, "Resource ID is required."),
});

const updateResourceParamsSchema = z.object({
  id: z.string().min(1, "Resource ID is required."),
  updates: z.object({
    name: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    data: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
    status: z.string().optional(), 
  }).refine(obj => Object.keys(obj).length > 0, {
    message: "Updates object cannot be empty.",
  }),
});

const deleteResourceParamsSchema = z.object({
  id: z.string().min(1, "Resource ID is required."),
});

export const ListResourcesParamsSchema = z.object({
  type: z.string().optional(),
});
export type ListResourcesParams = z.infer<typeof ListResourcesParamsSchema>;

// --- MCP Tool Handlers ---

const buildMcpContext = (extra: RequestHandlerExtra<ServerRequest, ServerNotification>): McpExecutionContext => {
  const requestId = extra.requestId.toString();
  const authInfo = extra.authInfo as AuthPayload | undefined;
  return {
    requestId,
    logger: logger.child({ requestId }),
    authInfo,
  };
};

/**
 * Creates a new resource.
 * Requires 'write:resource' scope.
 */
export async function handleCreateResource(
  request: McpRequest,
  context: ToolContext,
): Promise<McpResponse> {
  context.logger.info(`Handling createResource request: ${request.id}`);
  try {
    const params = createResourceParamsSchema.parse(request.params);
    
    const resourceData: Partial<Resource> = {
      id: params.id,
      name: params.name,
      type: params.type,
      data: params.data,
      metadata: params.metadata,
    };

    const newResource = await resourceService.createResource(resourceData as Resource);
    return {
      id: request.id,
      jsonrpc: '2.0',
      result: newResource,
    };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw new McpApplicationError('Invalid parameters for createResource.', 'INVALID_PARAMS', error.format());
    }
    context.logger.error(`Error in handleCreateResource: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Retrieves a resource by its ID.
 * Requires 'read:resource' scope.
 */
export async function handleGetResource(
  request: McpRequest,
  context: ToolContext,
): Promise<McpResponse> {
  context.logger.info(`Handling getResource request: ${request.id}`);
  try {
    const { id } = getResourceParamsSchema.parse(request.params);
    const resource = await resourceService.getResourceById(id);
    if (!resource) {
      throw new McpApplicationError(`Resource with ID '${id}' not found.`, 'RESOURCE_NOT_FOUND', { resourceId: id }, 404);
    }
    return {
      id: request.id,
      jsonrpc: '2.0',
      result: resource,
    };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw new McpApplicationError('Invalid parameters for getResource.', 'INVALID_PARAMS', error.format());
    }
    context.logger.error(`Error in handleGetResource: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Updates an existing resource.
 * Requires 'write:resource' scope.
 */
export async function handleUpdateResource(
  request: McpRequest,
  context: ToolContext,
): Promise<McpResponse> {
  context.logger.info(`Handling updateResource request: ${request.id}`);
  try {
    const { id, updates } = updateResourceParamsSchema.parse(request.params);
    const updatedResource = await resourceService.updateResource(id, updates as Partial<Resource>);
    if (!updatedResource) {
      throw new McpApplicationError(`Resource with ID '${id}' not found for update.`, 'RESOURCE_NOT_FOUND', { resourceId: id }, 404);
    }
    return {
      id: request.id,
      jsonrpc: '2.0',
      result: updatedResource,
    };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw new McpApplicationError('Invalid parameters for updateResource.', 'INVALID_PARAMS', error.format());
    }
    context.logger.error(`Error in handleUpdateResource: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Deletes a resource by its ID.
 * Requires 'write:resource' scope (or a more specific 'delete:resource').
 */
export async function handleDeleteResource(
  request: McpRequest,
  context: ToolContext,
): Promise<McpResponse> {
  context.logger.info(`Handling deleteResource request: ${request.id}`);
  try {
    const { id } = deleteResourceParamsSchema.parse(request.params);
    const success = await resourceService.deleteResource(id);
    if (!success) {
      throw new McpApplicationError(`Resource with ID '${id}' not found for deletion.`, 'RESOURCE_NOT_FOUND', { resourceId: id }, 404);
    }
    return {
      id: request.id,
      jsonrpc: '2.0',
      result: { success: true, message: `Resource '${id}' deleted successfully.` },
    };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw new McpApplicationError('Invalid parameters for deleteResource.', 'INVALID_PARAMS', error.format());
    }
    context.logger.error(`Error in handleDeleteResource: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Lists resources, optionally filtered by type. Owned by the authenticated user.
 * Requires 'read:resource' scope.
 */
export async function handleListResources(
  params: ListResourcesParams,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
): Promise<CallToolResult> {
  const context = buildMcpContext(extra);
  context.logger.info(`handleListResources called with type: ${params.type || 'all'}`, { requestId: context.requestId });
  if (!context.authInfo?.sub) {
    throw new McpApplicationError('User authentication is required to list their resources.', 'AUTHENTICATION_REQUIRED');
  }

  try {
    let resources: Resource[];
    if (params.type) {
      resources = await resourceService.listByType(params.type, context.authInfo.sub);
    } else {
      resources = await resourceService.listByOwner(context.authInfo.sub);
    }
    return { content: [{ type: 'text', text: JSON.stringify({ resources: resources }) }] };
  } catch (error: any) {
    context.logger.error('Error in handleListResources:', { error, requestId: context.requestId });
    if (error instanceof McpApplicationError) throw error;
    throw new McpApplicationError(error.message || 'Failed to list resources', error.code || 'RESOURCE_LISTING_FAILED', error.details);
  }
} 