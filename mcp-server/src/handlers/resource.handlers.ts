import { z } from 'zod';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

import { McpExecutionContext, McpNotFoundError, McpApplicationError, CallToolResult } from '@/core/mcp-types';
import resourceService, { Resource } from '@/services/resource.service';
import { AuthPayload } from '@/middleware/auth.middleware';
import logger from '@/utils/logger';

// --- Zod Schemas for Tool Parameters ---

export const CreateResourceParamsSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  content: z.any(),
  metadata: z.record(z.any()).optional(),
});
export type CreateResourceParams = z.infer<typeof CreateResourceParamsSchema>;

export const GetResourceParamsSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});
export type GetResourceParams = z.infer<typeof GetResourceParamsSchema>;

export const UpdateResourceParamsSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  type: z.string().optional(),
  content: z.any().optional(),
  metadata: z.record(z.any()).optional(),
});
export type UpdateResourceParams = z.infer<typeof UpdateResourceParamsSchema>;

export const DeleteResourceParamsSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});
export type DeleteResourceParams = z.infer<typeof DeleteResourceParamsSchema>;

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
  params: CreateResourceParams,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
): Promise<CallToolResult> {
  const context = buildMcpContext(extra);
  context.logger.info(`handleCreateResource called with type: ${params.type}`, { requestId: context.requestId });
  if (!context.authInfo?.sub) {
    throw new McpApplicationError('User authentication is required to create a resource.', 'AUTHENTICATION_REQUIRED');
  }

  try {
    const resource = await resourceService.create(
      params.type,
      params.content,
      context.authInfo.sub,
      params.metadata
    );
    return { content: [{ type: 'text', text: JSON.stringify(resource) }] };
  } catch (error: any) {
    context.logger.error('Error in handleCreateResource:', { error, requestId: context.requestId });
    throw new McpApplicationError(error.message || 'Failed to create resource', error.code || 'RESOURCE_CREATION_FAILED', error.details);
  }
}

/**
 * Retrieves a resource by its ID.
 * Requires 'read:resource' scope.
 */
export async function handleGetResource(
  params: GetResourceParams,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
): Promise<CallToolResult> {
  const context = buildMcpContext(extra);
  context.logger.info(`handleGetResource called for id: ${params.id}`, { requestId: context.requestId });
  try {
    const resource = await resourceService.getById(params.id);
    if (!resource) {
      throw new McpNotFoundError(`Resource with ID '${params.id}' not found.`);
    }
    if (resource.ownerId && context.authInfo?.sub !== resource.ownerId) {
        throw new McpApplicationError('You are not authorized to access this resource.', 'AUTHORIZATION_FAILED');
    }
    return { content: [{ type: 'text', text: JSON.stringify(resource) }] };
  } catch (error: any) {
    context.logger.error('Error in handleGetResource:', { error, requestId: context.requestId });
    if (error instanceof McpApplicationError) throw error;
    throw new McpApplicationError(error.message || 'Failed to retrieve resource', error.code || 'RESOURCE_RETRIEVAL_FAILED', error.details);
  }
}

/**
 * Updates an existing resource.
 * Requires 'write:resource' scope.
 */
export async function handleUpdateResource(
  params: UpdateResourceParams,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
): Promise<CallToolResult> {
  const context = buildMcpContext(extra);
  context.logger.info(`handleUpdateResource called for id: ${params.id}`, { requestId: context.requestId });
  if (!context.authInfo?.sub) {
    throw new McpApplicationError('User authentication is required to update this resource.', 'AUTHENTICATION_REQUIRED');
  }

  try {
    const existingResource = await resourceService.getById(params.id);
    if (!existingResource) {
      throw new McpNotFoundError(`Resource with ID '${params.id}' not found for update.`);
    }
    if (existingResource.ownerId && context.authInfo.sub !== existingResource.ownerId) {
      throw new McpApplicationError('You are not authorized to update this resource (not owner).', 'AUTHORIZATION_FAILED');
    }

    const updatePayload: Partial<Pick<Resource, 'type' | 'content' | 'metadata'>> = {};
    if (params.type !== undefined) updatePayload.type = params.type;
    if (params.content !== undefined) updatePayload.content = params.content;
    if (params.metadata !== undefined) updatePayload.metadata = params.metadata;

    const updatedResource = await resourceService.update(params.id, updatePayload);
    if (!updatedResource) {
      throw new McpNotFoundError(`Resource with ID '${params.id}' could not be updated or was not found.`);
    }
    return { content: [{ type: 'text', text: JSON.stringify(updatedResource) }] };
  } catch (error: any) {
    context.logger.error('Error in handleUpdateResource:', { error, requestId: context.requestId });
    if (error instanceof McpApplicationError) throw error;
    throw new McpApplicationError(error.message || 'Failed to update resource', error.code || 'RESOURCE_UPDATE_FAILED', error.details);
  }
}

/**
 * Deletes a resource by its ID.
 * Requires 'write:resource' scope (or a more specific 'delete:resource').
 */
export async function handleDeleteResource(
  params: DeleteResourceParams,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
): Promise<CallToolResult> {
  const context = buildMcpContext(extra);
  context.logger.info(`handleDeleteResource called for id: ${params.id}`, { requestId: context.requestId });
  if (!context.authInfo?.sub) {
    throw new McpApplicationError('User authentication is required to delete this resource.', 'AUTHENTICATION_REQUIRED');
  }
  try {
    const existingResource = await resourceService.getById(params.id);
    if (!existingResource) {
      throw new McpNotFoundError(`Resource with ID '${params.id}' not found for deletion.`);
    }
    if (existingResource.ownerId && context.authInfo.sub !== existingResource.ownerId) {
      throw new McpApplicationError('You are not authorized to delete this resource (not owner).', 'AUTHORIZATION_FAILED');
    }

    const success = await resourceService.delete(params.id);
    if (!success) {
      throw new McpApplicationError(`Failed to delete resource with ID '${params.id}'.`, 'RESOURCE_DELETION_FAILED');
    }
    return { content: [{ type: 'text', text: `Resource ${params.id} deleted successfully.` }] };
  } catch (error: any) {
    context.logger.error('Error in handleDeleteResource:', { error, requestId: context.requestId });
    if (error instanceof McpApplicationError) throw error;
    throw new McpApplicationError(error.message || 'Failed to delete resource', error.code || 'RESOURCE_DELETION_FAILED', error.details);
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