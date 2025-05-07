import { handleScanRepository } from '@/handlers/scanner.handlers';
import { RepositoryScannerService } from '@/services/repositoryScanner.service';
import { ScanPersistenceService } from '@/services/scanPersistence.service';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/server/transport.js';
import { 
  McpRequest, 
  McpResponse, 
  HttpMethod, 
  RequestHandlerExtra, 
  ToolContext 
} from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ZodError } from 'zod';

// Mocks
// ... existing code ... 