// We'll replace the SDK imports with our own type definitions
// import { CallToolResult, McpErrorPayload } from '@modelcontextprotocol/sdk/types.js';

import logger from '@/utils/logger';
import { AuthPayload } from '@/middleware/auth.middleware';

// Define our own CallToolResult type to match the SDK
export interface CallToolResult {
  content: Array<{ type: string; text: string; }>;
}

/**
 * Represents the context for a command execution.
 * This can be expanded as needed with application-specific context,
 * such as user information, database connections, etc.
 */
export interface McpExecutionContext {
  readonly requestId: string;
  readonly logger: typeof logger; // Instance of our application logger, pre-configured with requestId if possible
  readonly authInfo?: AuthPayload;
  // readonly auth?: AuthContext; // Example: decoded JWT payload or user session
  // readonly db?: any; // Example: database client
}

/**
 * Type for a tool handler function.
 * It receives validated arguments (if a Zod schema is provided)
 * and the execution context.
 * Aligns with SDK: should return CallToolResult or throw an McpApplicationError.
 */
export type McpToolHandler<TArgs = any> = (
  args: TArgs,
  context: McpExecutionContext
) => Promise<CallToolResult> | CallToolResult;

// --- Custom Application Errors ---

export interface McpErrorPayload {
  code: string;       // e.g., 'VALIDATION_ERROR', 'NOT_FOUND', 'INTERNAL_SERVER_ERROR'
  message: string;
  details?: any;     // Optional structured details
}

export class McpApplicationError extends Error {
  public code: string;
  public details?: any;
  public statusCode?: number;

  constructor(message: string, code: string, details?: any, statusCode?: number) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class McpValidationError extends McpApplicationError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(message, 'VALIDATION_ERROR', details, 400);
  }
}

export class McpNotFoundError extends McpApplicationError {
  constructor(message: string = 'Resource not found', details?: any) {
    super(message, 'NOT_FOUND', details, 404);
  }
}

export class McpInternalError extends McpApplicationError {
  constructor(message: string = 'An internal server error occurred', details?: any) {
    super(message, 'INTERNAL_SERVER_ERROR', details, 500);
  }
}

export class McpAuthorizationError extends McpApplicationError {
    constructor(message: string = 'Authorization failed', details?: any) {
        super(message, 'AUTHORIZATION_FAILED', details, 403);
    }
}

export class McpAuthenticationError extends McpApplicationError {
    constructor(message: string = 'Authentication required', details?: any) {
        super(message, 'AUTHENTICATION_REQUIRED', details, 401);
    }
} 