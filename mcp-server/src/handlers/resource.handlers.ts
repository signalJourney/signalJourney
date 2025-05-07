import { z } from 'zod';
import resourceService, { Resource } from '@/services/resource.service';
import { McpExecutionContext, McpToolOutput, McpNotFoundError, McpApplicationError } from '@/core/mcp-types';
import { AuthPayload } from '@/middleware/auth.middleware';
import logger from '@/utils/logger';

// --- Zod Schemas for Tool Parameters ---

export const CreateResourceParamsSchema = z.object({
  type: z.string().min(1, 'Resource type is required'),
  content: z.any(), // Content can be any structure, specific validation might be per type
  metadata: z.record(z.any()).optional(),
});
export type CreateResourceParams = z.infer<typeof CreateResourceParamsSchema>;

export const GetResourceParamsSchema = z.object({
  id: z.string().uuid('Valid resource ID (UUID) is required'),
});
export type GetResourceParams = z.infer<typeof GetResourceParamsSchema>;

export const UpdateResourceParamsSchema = z.object({
  id: z.string().uuid('Valid resource ID (UUID) is required'),
  type: z.string().min(1).optional(), // Allow updating type
  content: z.any().optional(),
  metadata: z.record(z.any()).optional(),
});
export type UpdateResourceParams = z.infer<typeof UpdateResourceParamsSchema>;

export const DeleteResourceParamsSchema = z.object({
  id: z.string().uuid('Valid resource ID (UUID) is required'),
});
export type DeleteResourceParams = z.infer<typeof DeleteResourceParamsSchema>;

export const ListResourcesParamsSchema = z.object({
  type: z.string().min(1).optional(),
  // ownerId: z.string().uuid().optional(), // If we want to filter by owner via tool params
});
export type ListResourcesParams = z.infer<typeof ListResourcesParamsSchema>;

// --- MCP Tool Handlers ---

/**
 * Creates a new resource.
 * Requires 'write:resource' scope.
 */
export async function handleCreateResource(
  params: CreateResourceParams,
  context: McpExecutionContext
): Promise<McpToolOutput<Resource>> {
  logger.info(`handleCreateResource called with type: ${params.type}`, { requestId: context.requestId });
  const authInfo = context.authInfo as AuthPayload | undefined;
  if (!authInfo?.userId) {
    throw new McpApplicationError('User authentication is required to create a resource.', 'AUTHENTICATION_REQUIRED');
  }

  try {
    const resource = await resourceService.create(
      params.type,
      params.content,
      authInfo.userId, // Set ownerId from authenticated user
      params.metadata
    );
    return { success: true, data: resource };
  } catch (error: any) {
    logger.error('Error in handleCreateResource:', { error, requestId: context.requestId });
    throw new McpApplicationError(error.message || 'Failed to create resource', error.code || 'RESOURCE_CREATION_FAILED', error.details);
  }
}

/**
 * Retrieves a resource by its ID.
 * Requires 'read:resource' scope.
 */
export async function handleGetResource(
  params: GetResourceParams,
  context: McpExecutionContext
): Promise<McpToolOutput<Resource>> {
  logger.info(`handleGetResource called for id: ${params.id}`, { requestId: context.requestId });
  try {
    const resource = await resourceService.getById(params.id);
    if (!resource) {
      throw new McpNotFoundError(`Resource with ID '${params.id}' not found.`);
    }
    // Optional: Check ownership or general read access if needed, beyond scope check
    // const authInfo = context.authInfo as AuthPayload | undefined;
    // if (resource.ownerId && authInfo?.userId !== resource.ownerId) {
    //   // This depends on how strict resource access is, scopes might be enough
    //   throw new McpApplicationError('You are not authorized to access this specific resource.', 'AUTHORIZATION_FAILED');
    // }
    return { success: true, data: resource };
  } catch (error: any) {
    logger.error('Error in handleGetResource:', { error, requestId: context.requestId });
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
  context: McpExecutionContext
): Promise<McpToolOutput<Resource>> {
  logger.info(`handleUpdateResource called for id: ${params.id}`, { requestId: context.requestId });
  const authInfo = context.authInfo as AuthPayload | undefined;

  try {
    const existingResource = await resourceService.getById(params.id);
    if (!existingResource) {
      throw new McpNotFoundError(`Resource with ID '${params.id}' not found for update.`);
    }
    if (existingResource.ownerId && authInfo?.userId !== existingResource.ownerId) {
      throw new McpApplicationError('You are not authorized to update this resource (not owner).', 'AUTHORIZATION_FAILED');
    }

    const updates: Partial<Pick<Resource, 'content' | 'metadata' | 'type'>> = {};
    if (params.content !== undefined) updates.content = params.content;
    if (params.metadata !== undefined) updates.metadata = params.metadata;
    if (params.type !== undefined) updates.type = params.type;

    const updatedResource = await resourceService.update(params.id, updates);
    if (!updatedResource) {
      // Should be caught by getById earlier, but as a safeguard
      throw new McpNotFoundError(`Resource with ID '${params.id}' could not be updated or was not found.`);
    }
    return { success: true, data: updatedResource };
  } catch (error: any) {
    logger.error('Error in handleUpdateResource:', { error, requestId: context.requestId });
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
  context: McpExecutionContext
): Promise<McpToolOutput<{ id: string; deleted: boolean }>> {
  logger.info(`handleDeleteResource called for id: ${params.id}`, { requestId: context.requestId });
  const authInfo = context.authInfo as AuthPayload | undefined;
  try {
    const existingResource = await resourceService.getById(params.id);
    if (!existingResource) {
      throw new McpNotFoundError(`Resource with ID '${params.id}' not found for deletion.`);
    }
    if (existingResource.ownerId && authInfo?.userId !== existingResource.ownerId) {
      throw new McpApplicationError('You are not authorized to delete this resource (not owner).', 'AUTHORIZATION_FAILED');
    }

    const deleted = await resourceService.delete(params.id);
    if (!deleted) {
      // Should be caught by getById, but as a safeguard
      throw new McpApplicationError(`Failed to delete resource with ID '${params.id}'.`, 'RESOURCE_DELETION_FAILED');
    }
    return { success: true, data: { id: params.id, deleted } };
  } catch (error: any) {
    logger.error('Error in handleDeleteResource:', { error, requestId: context.requestId });
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
  context: McpExecutionContext
): Promise<McpToolOutput<Resource[]>> {
  logger.info(`handleListResources called with type: ${params.type || 'all'}`, { requestId: context.requestId });
  const authInfo = context.authInfo as AuthPayload | undefined;
  if (!authInfo?.userId) {
    // For listing, we might allow listing public resources or require auth for user-specific ones.
    // Here, we assume listing is for user-owned resources.
    throw new McpApplicationError('User authentication is required to list their resources.', 'AUTHENTICATION_REQUIRED');
  }

  try {
    let resources: Resource[];
    if (params.type) {
      resources = await resourceService.listByType(params.type, authInfo.userId);
    } else {
      resources = await resourceService.listByOwner(authInfo.userId);
    }
    return { success: true, data: resources };
  } catch (error: any) {
    logger.error('Error in handleListResources:', { error, requestId: context.requestId });
    if (error instanceof McpApplicationError) throw error;
    throw new McpApplicationError(error.message || 'Failed to list resources', error.code || 'RESOURCE_LISTING_FAILED', error.details);
  }
} 