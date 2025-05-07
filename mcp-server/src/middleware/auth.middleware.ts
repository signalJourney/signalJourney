import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '@/config';
import logger from '@/utils/logger';
import { McpApplicationError } from '@/core/mcp-types'; // Assuming McpApplicationError is defined

// Define a structure for the JWT payload
export interface AuthPayload {
  userId: string;
  username: string;
  scopes: string[]; // e.g., ['read:pipeline', 'write:docs']
  // Standard JWT claims like iat, exp can also be here
  iat?: number;
  exp?: number;
}

// Extend Express Request type to include authInfo
export interface AuthenticatedRequest extends express.Request {
  authInfo?: AuthPayload;
}

/**
 * JWT Authentication Middleware.
 * Verifies JWT from Authorization header and attaches payload to req.authInfo.
 * If token is invalid/expired, it will clear authInfo.
 * It does NOT reject the request here; route handlers or subsequent middleware
 * should check for req.authInfo if authentication is strictly required for a route.
 */
export const jwtAuthMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const requestId = res.locals.requestId || 'unknown'; // Get requestId from previous middleware

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided, proceed without authInfo
    // Protected routes should check for req.authInfo later
    return next();
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    // Token is empty after Bearer, proceed without authInfo
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.security.jwtSecret) as AuthPayload;
    req.authInfo = decoded;
    logger.debug(`JWT verified for user: ${decoded.userId}, requestId: ${requestId}`);
    next();
  } catch (error: any) {
    logger.warn(`JWT verification failed: ${error.message}, requestId: ${requestId}`);
    // Token is invalid or expired. Clear authInfo and proceed.
    // Specific routes can then decide to reject if authInfo is missing.
    // Alternatively, could call next(new McpApplicationError('Invalid or expired token', 'AUTHENTICATION_FAILED', { originalError: error.message }));
    // For now, let's just clear and proceed, allowing public access to some tools and specific checks later.
    req.authInfo = undefined; 
    next();
  }
};

/**
 * Authorization Middleware (example - to be used after jwtAuthMiddleware).
 * Checks if the authenticated user (from req.authInfo) has the required scope(s).
 * @param requiredScopes - A single scope string or an array of scopes.
 */
export const requireScope = (requiredScopes: string | string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const requestId = res.locals.requestId || 'unknown';
    if (!req.authInfo) {
      logger.warn(`Authorization failed: No authentication information found, requestId: ${requestId}`);
      return next(new McpApplicationError('Authentication required.', 'AUTHENTICATION_REQUIRED'));
    }

    const scopes = Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes];
    const userScopes = req.authInfo.scopes || [];

    const hasAllRequiredScopes = scopes.every(scope => userScopes.includes(scope));

    if (!hasAllRequiredScopes) {
      logger.warn(
        `Authorization failed: User ${req.authInfo.userId} missing required scopes. Required: ${scopes.join(',')}, User has: ${userScopes.join(',')}, requestId: ${requestId}`
      );
      return next(
        new McpApplicationError(
          'Insufficient permissions. You do not have the required scopes to access this resource.',
          'AUTHORIZATION_FAILED'
        )
      );
    }
    logger.debug(`Authorization successful for user: ${req.authInfo.userId}, scopes: ${scopes.join(',')}, requestId: ${requestId}`);
    next();
  };
}; 