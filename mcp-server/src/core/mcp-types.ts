import { ZodSchema } from 'zod';
import { McpExecutionInput, McpExecutionOutput, McpToolDefinition } from '@modelcontextprotocol/sdk';
import logger from '@/utils/logger';
import { AuthPayload } from '@/middleware/auth.middleware';

// --- Re-exporting core SDK types for convenience and potential future extension ---
export type { McpExecutionInput, McpExecutionOutput, McpToolDefinition };

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
 * Defines the structure for a successful tool execution result.
 * Tools should return data that can be serialized to JSON.
 */
export interface McpToolSuccessResponse<TResult = any> {
  result: TResult;
}

/**
 * Defines the structure for an error response from a tool execution.
 */
export interface McpToolErrorResponse {
  error: {
    code: string; // Application-specific error code (e.g., 'VALIDATION_ERROR', 'NOT_FOUND', 'INTERNAL_ERROR')
    message: string; // Human-readable error message
    details?: any; // Optional: additional error details (e.g., validation failures)
  };
}

/**
 * Represents the output of an MCP tool, which can be either a success or an error.
 * This aligns with how the McpServer in the SDK expects tool execution results.
 */
export type McpToolOutput<TResult = any> =
  | McpToolSuccessResponse<TResult>
  | McpToolErrorResponse;

/**
 * Type for a tool handler function.
 * It receives validated arguments (if a Zod schema is provided in McpToolDefinition)
 * and the execution context.
 */
export type McpToolHandler<TArgs = any, TResult = any> = (
  args: TArgs,
  context: McpExecutionContext
) => Promise<McpToolOutput<TResult>>; // SDK's McpServer expects the execute function to return the raw result or throw an error that it converts.
                                      // However, for our internal handling, we might prefer a structured success/error union.
                                      // For now, let's align with SDK: return TResult or throw McpError.

// --- Custom Application Errors ---

export class McpApplicationError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, McpApplicationError.prototype);
  }

  toErrorResponse(): McpToolErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export class McpValidationError extends McpApplicationError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'McpValidationError';
    Object.setPrototypeOf(this, McpValidationError.prototype);
  }
}

export class McpNotFoundError extends McpApplicationError {
  constructor(message: string = 'Resource not found', details?: any) {
    super(message, 'NOT_FOUND', details);
    this.name = 'McpNotFoundError';
    Object.setPrototypeOf(this, McpNotFoundError.prototype);
  }
}

export class McpInternalError extends McpApplicationError {
  constructor(message: string = 'An internal server error occurred', details?: any) {
    super(message, 'INTERNAL_ERROR', details);
    this.name = 'McpInternalError';
    Object.setPrototypeOf(this, McpInternalError.prototype);
  }
}

/**
 * Helper function to create a success response.
 * Note: The McpServer.tool().execute method should directly return the result data,
 * not this wrapped object. This is for internal use if needed elsewhere.
 */
export function createMcpSuccessResponse<TResult>(
  result: TResult
): McpToolSuccessResponse<TResult> {
  return { result };
}

/**
 * Helper function to create an error response.
 * Note: The McpServer.tool().execute method should throw an error, 
 * and the server will format it. This is for internal use.
 */
export function createMcpErrorResponse(
  code: string,
  message: string,
  details?: any
): McpToolErrorResponse {
  return {
    error: {
      code,
      message,
      details,
    },
  };
} 