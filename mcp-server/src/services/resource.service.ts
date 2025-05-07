import { randomUUID } from 'crypto';
import logger from '@/utils/logger';
import { McpNotFoundError } from '@/core/mcp-types';

export interface Resource {
  id: string;
  type: string; // e.g., 'document', 'pipeline_config', 'raw_data_reference'
  content: any; // The actual content or a reference to it
  ownerId?: string; // ID of the user who created/owns this resource
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

class ResourceService {
  private resources: Map<string, Resource> = new Map();

  constructor() {
    logger.info('ResourceService initialized (in-memory).');
    // Example: Load initial/seed resources if needed
  }

  async create(
    type: string,
    content: any,
    ownerId?: string,
    metadata?: Record<string, any>
  ): Promise<Resource> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const resource: Resource = {
      id,
      type,
      content,
      ownerId,
      metadata: metadata || {},
      createdAt: now,
      updatedAt: now,
    };
    this.resources.set(id, resource);
    logger.info(`Resource created: type '${type}', id '${id}', owner '${ownerId || 'system'}'`);
    return resource;
  }

  async getById(id: string): Promise<Resource | null> {
    const resource = this.resources.get(id);
    if (!resource) {
      logger.warn(`Resource not found: id '${id}'`);
      return null;
    }
    logger.debug(`Resource retrieved: id '${id}'`);
    return resource;
  }

  async update(
    id: string,
    updates: Partial<Pick<Resource, 'content' | 'metadata' | 'type'>>
  ): Promise<Resource | null> {
    const resource = this.resources.get(id);
    if (!resource) {
      logger.warn(`Resource update failed: id '${id}' not found.`);
      return null;
    }

    const updatedResource: Resource = {
      ...resource,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.resources.set(id, updatedResource);
    logger.info(`Resource updated: id '${id}'`);
    return updatedResource;
  }

  async delete(id: string): Promise<boolean> {
    if (!this.resources.has(id)) {
      logger.warn(`Resource deletion failed: id '${id}' not found.`);
      return false;
    }
    this.resources.delete(id);
    logger.info(`Resource deleted: id '${id}'`);
    return true;
  }

  async listByType(type: string, ownerId?: string): Promise<Resource[]> {
    let results: Resource[] = [];
    this.resources.forEach(resource => {
      if (resource.type === type) {
        if (ownerId && resource.ownerId !== ownerId) {
          // Skip if ownerId is specified and doesn't match
          return;
        }
        results.push(resource);
      }
    });
    logger.debug(`Listed ${results.length} resources of type '${type}' for owner '${ownerId || 'any'}'`);
    return results;
  }

  async listByOwner(ownerId: string): Promise<Resource[]> {
    let results: Resource[] = [];
    this.resources.forEach(resource => {
      if (resource.ownerId === ownerId) {
        results.push(resource);
      }
    });
    logger.debug(`Listed ${results.length} resources for owner '${ownerId}'`);
    return results;
  }
  
  // For testing or admin purposes
  async clearAllResources(): Promise<void> {
    this.resources.clear();
    logger.info('All in-memory resources cleared.');
  }
}

const resourceService = new ResourceService();
export default resourceService; 