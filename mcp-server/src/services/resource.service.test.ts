import resourceService, { Resource } from './resource.service';
import { randomUUID } from 'crypto'; // Ensure this is mocked or controlled if IDs need to be predictable

// Mock logger to prevent console output during tests and allow assertions
jest.mock('@/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Optional: Mock randomUUID if you need predictable IDs for testing specific scenarios
// jest.mock('crypto', () => ({
//   ...jest.requireActual('crypto'), // Import and retain default behavior
//   randomUUID: jest.fn().mockReturnValue('mock-uuid-123'),
// }));


describe('ResourceService', () => {
  beforeEach(async () => {
    // Clear all resources before each test to ensure a clean state
    // This relies on the service being a singleton and having a clear method, or re-instantiate.
    await resourceService.clearAllResources(); 
    jest.clearAllMocks(); // Clear logger mocks
  });

  const testOwnerId = 'owner-test-123';
  const resourceType = 'document';
  const resourceContent = { title: 'Test Document', body: 'Hello world' };
  const resourceMetadata = { version: '1.0', tags: ['test'] };

  describe('create', () => {
    it('should create a new resource with given parameters and assign an ID and timestamps', async () => {
      const resource = await resourceService.create(resourceType, resourceContent, testOwnerId, resourceMetadata);
      
      expect(resource).toBeDefined();
      expect(resource.id).toEqual(expect.any(String)); // Or a specific mocked UUID if randomUUID is mocked
      expect(resource.type).toBe(resourceType);
      expect(resource.content).toEqual(resourceContent);
      expect(resource.ownerId).toBe(testOwnerId);
      expect(resource.metadata).toEqual(resourceMetadata);
      expect(resource.createdAt).toEqual(expect.any(String));
      expect(resource.updatedAt).toEqual(expect.any(String));
      expect(resource.createdAt).toEqual(resource.updatedAt);
    });

    it('should create a resource without metadata if not provided', async () => {
      const resource = await resourceService.create(resourceType, resourceContent, testOwnerId);
      expect(resource.metadata).toEqual({});
    });

    it('should create a resource without an ownerId if not provided', async () => {
      const resource = await resourceService.create(resourceType, resourceContent);
      expect(resource.ownerId).toBeUndefined();
    });
  });

  describe('getById', () => {
    it('should retrieve an existing resource by its ID', async () => {
      const createdResource = await resourceService.create(resourceType, resourceContent, testOwnerId);
      const retrievedResource = await resourceService.getById(createdResource.id);
      
      expect(retrievedResource).toEqual(createdResource);
    });

    it('should return null if a resource with the given ID does not exist', async () => {
      const nonExistentId = randomUUID(); // Or a fixed string not in the map
      const resource = await resourceService.getById(nonExistentId);
      expect(resource).toBeNull();
    });
  });

  describe('update', () => {
    it('should update an existing resource with new content and metadata', async () => {
      const createdResource = await resourceService.create(resourceType, resourceContent, testOwnerId);
      const updates = {
        content: { title: 'Updated Document', body: 'New content' },
        metadata: { version: '2.0', status: 'reviewed' },
        type: 'article'
      };

      // Ensure a slight delay for updatedAt to be different if not mocking Date
      await new Promise(resolve => setTimeout(resolve, 10)); 

      const updatedResource = await resourceService.update(createdResource.id, updates);
      
      expect(updatedResource).toBeDefined();
      expect(updatedResource!.id).toBe(createdResource.id);
      expect(updatedResource!.type).toBe(updates.type);
      expect(updatedResource!.content).toEqual(updates.content);
      expect(updatedResource!.metadata).toEqual(updates.metadata);
      expect(updatedResource!.ownerId).toBe(createdResource.ownerId);
      expect(updatedResource!.createdAt).toBe(createdResource.createdAt);
      expect(updatedResource!.updatedAt).not.toBe(createdResource.updatedAt);
    });

    it('should only update provided fields', async () => {
      const createdResource = await resourceService.create(resourceType, resourceContent, testOwnerId, resourceMetadata);
      const updates = { content: { title: 'Only Title Updated' } };
      
      const updatedResource = await resourceService.update(createdResource.id, updates);
      
      expect(updatedResource!.content.title).toBe('Only Title Updated');
      expect((updatedResource!.content as any).body).toBeUndefined(); // Assuming partial update of content
      expect(updatedResource!.metadata).toEqual(resourceMetadata); // Metadata should remain unchanged
      expect(updatedResource!.type).toBe(resourceType);
    });

    it('should return null if trying to update a non-existent resource', async () => {
      const nonExistentId = randomUUID();
      const updatedResource = await resourceService.update(nonExistentId, { content: 'test' });
      expect(updatedResource).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an existing resource and return true', async () => {
      const createdResource = await resourceService.create(resourceType, resourceContent, testOwnerId);
      const result = await resourceService.delete(createdResource.id);
      
      expect(result).toBe(true);
      const retrievedResource = await resourceService.getById(createdResource.id);
      expect(retrievedResource).toBeNull();
    });

    it('should return false if trying to delete a non-existent resource', async () => {
      const nonExistentId = randomUUID();
      const result = await resourceService.delete(nonExistentId);
      expect(result).toBe(false);
    });
  });

  describe('listByType', () => {
    beforeEach(async () => {
      await resourceService.create('document', {title: 'Doc 1'}, testOwnerId);
      await resourceService.create('document', {title: 'Doc 2'}, 'other-owner');
      await resourceService.create('image', {url: 'img1.jpg'}, testOwnerId);
      await resourceService.create('document', {title: 'Doc 3'}, testOwnerId);
    });

    it('should list all resources of a specific type for a specific owner', async () => {
      const documents = await resourceService.listByType('document', testOwnerId);
      expect(documents.length).toBe(2);
      expect(documents.every(doc => doc.type === 'document' && doc.ownerId === testOwnerId)).toBe(true);
      expect(documents.find(d => d.content.title === 'Doc 1')).toBeDefined();
      expect(documents.find(d => d.content.title === 'Doc 3')).toBeDefined();
    });

    it('should list all resources of a specific type if ownerId is not provided (all owners)', async () => {
      const documents = await resourceService.listByType('document');
      expect(documents.length).toBe(3); // Doc 1, Doc 2, Doc 3
      expect(documents.every(doc => doc.type === 'document')).toBe(true);
    });

    it('should return an empty array if no resources match the type and owner', async () => {
      const videos = await resourceService.listByType('video', testOwnerId);
      expect(videos.length).toBe(0);
    });
  });

  describe('listByOwner', () => {
    beforeEach(async () => {
      await resourceService.create('document', {title: 'Owner1 Doc1'}, testOwnerId);
      await resourceService.create('image', {url: 'Owner1 Img1'}, testOwnerId);
      await resourceService.create('document', {title: 'Owner2 Doc1'}, 'another-owner-id');
    });

    it('should list all resources for a specific owner', async () => {
      const resources = await resourceService.listByOwner(testOwnerId);
      expect(resources.length).toBe(2);
      expect(resources.every(res => res.ownerId === testOwnerId)).toBe(true);
    });

    it('should return an empty array if the owner has no resources', async () => {
      const resources = await resourceService.listByOwner('non-existent-owner');
      expect(resources.length).toBe(0);
    });
  });
  
  describe('clearAllResources', () => {
    it('should remove all resources from the service', async () => {
      await resourceService.create(resourceType, resourceContent, testOwnerId);
      await resourceService.clearAllResources();
      const resources = await resourceService.listByOwner(testOwnerId); // Or any list method
      expect(resources.length).toBe(0);
      const anyResource = await resourceService.getById('any-id-after-clear');
      expect(anyResource).toBeNull();
    });
  });
}); 