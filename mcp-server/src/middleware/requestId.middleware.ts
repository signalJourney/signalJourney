import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
// import logger from '@/utils/logger'; // Removed logger

/**
 * Middleware to generate a unique request ID for each incoming request.
 * It attaches the requestId to `res.locals` for access within the request lifecycle
 * and sets an `X-Request-ID` header in the response for client-side tracing.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || randomUUID();
  
  // Make it available for other middlewares and handlers
  res.locals.requestId = requestId;

  // Also useful for logging within other parts of the application that have access to res.locals
  // If using a logger that supports async local storage or similar context propagation, this is even better.
  // For now, we rely on passing it through McpExecutionContext.

  // Set it as a response header for client-side correlation
  res.setHeader('X-Request-ID', requestId);

  // If your logger supports child loggers with bound context:
  // (req as any).logger = logger.child({ requestId }); // Example of attaching a request-specific logger

  next();
}; 