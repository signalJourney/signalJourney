import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import tokenService from '@/services/token.service';
import { AuthPayload, AuthenticatedRequest, jwtAuthMiddleware } from '@/middleware/auth.middleware';
import logger from '@/utils/logger';
import { McpApplicationError, McpValidationError, McpInternalError } from '@/core/mcp-types';

const router = Router();

// --- Schemas for request validation ---
const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  // apiKey: z.string().optional(), // Example for API key auth
});

const ValidateTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// --- Helper for Zod validation middleware (or use a library) ---
const validate = (schema: ZodSchema<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Pass to global error handler, which should format it
        next(new McpValidationError('Login validation failed', error.issues));
      } else {
        next(error);
      }
    }
  };

// --- Authentication Routes ---

/**
 * @route   POST /auth/login
 * @desc    Authenticate user and return JWT
 * @access  Public
 */
router.post('/login', validate(LoginSchema), async (req: Request, res: Response, next: NextFunction) => {
  const { username, password } = req.body as LoginSchemaType;
  const requestId = res.locals.requestId || 'unknown';

  try {
    // --- Mock User Validation --- 
    // In a real app, replace this with database lookup and password hashing (e.g., bcrypt.compare)
    if (username === 'testuser' && password === 'password123') {
      const userId = 'user-123'; // Mock user ID
      const scopes = ['read:resource', 'write:resource', 'read:pipeline', 'execute:pipeline']; // Example scopes
      
      const tokenPayload: Omit<AuthPayload, 'jti' | 'iat' | 'exp'> = {
        sub: userId,
        username,
        scopes,
      };
      const accessToken = tokenService.generateToken(tokenPayload);
      const decoded = tokenService.verifyToken(accessToken); // To get exp for expiresIn field

      logger.info(`User '${username}' logged in successfully. requestId: ${requestId}`);
      return res.json({
        accessToken,
        tokenType: 'Bearer',
        expiresIn: decoded?.exp ? (decoded.exp - Math.floor(Date.now() / 1000)) : undefined,
        sub: userId,
        username,
        scopes,
      });
    } else {
      logger.warn(`Login failed for user '${username}': Invalid credentials. requestId: ${requestId}`);
      // Use McpApplicationError for consistent error handling via global error middleware
      return next(new McpApplicationError('Invalid username or password', 'AUTHENTICATION_FAILED', { username }));
    }
  } catch (error) {
    logger.error('Error during login:', { error, requestId });
    return next(new McpInternalError('Login process failed'));
  }
});

/**
 * @route   POST /auth/validate-token
 * @desc    Validate an existing JWT
 * @access  Public
 */
router.post('/validate-token', validate(ValidateTokenSchema), async (req: Request, res: Response, next: NextFunction) => {
  const { token } = req.body as ValidateTokenSchemaType;
  const requestId = res.locals.requestId || 'unknown';
  try {
    const payload = tokenService.verifyToken(token);
    if (payload) {
      logger.info(`Token validated successfully for user: ${payload.sub}. jti: ${payload.jti}, requestId: ${requestId}`);
      return res.json({ 
        valid: true, 
        payload: {
            sub: payload.sub,
            username: payload.username,
            scopes: payload.scopes,
            jti: payload.jti,
            iat: payload.iat,
            exp: payload.exp,
        }
    });
    } else {
      logger.warn(`Token validation failed. Provided token is invalid or expired. requestId: ${requestId}`);
      // Error response consistent with McpApplicationError structure, handled by global error handler
      return next(new McpApplicationError('Invalid or expired token', 'TOKEN_VALIDATION_FAILED'));
    }
  } catch (error) {
    logger.error('Error during token validation:', { error, requestId });
    return next(new McpInternalError('Token validation process failed'));
  }
});

/**
 * @route   POST /auth/logout
 * @desc    Logout user (blacklist current token)
 * @access  Authenticated
 */
router.post('/logout', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const requestId = res.locals.requestId || 'unknown';
  try {
    if (req.authInfo && req.authInfo.jti && req.authInfo.exp) {
      await tokenService.blacklistToken(req.authInfo.jti, req.authInfo.exp);
      logger.info(`User ${req.authInfo.sub} logged out. Token jti: ${req.authInfo.jti} blacklisted. requestId: ${requestId}`);
      return res.status(200).json({ message: 'Successfully logged out.' });
    } else {
      logger.warn(`Logout attempt without valid authInfo or jti/exp. requestId: ${requestId}`);
      // This case implies jwtAuthMiddleware didn't populate authInfo or token was malformed.
      return next(new McpApplicationError('No active session to log out or token is invalid.', 'LOGOUT_FAILED'));
    }
  } catch (error) {
    logger.error('Error during logout:', { error, requestId });
    return next(new McpInternalError('Logout process failed'));
  }
});

// Helper types for request body inference if needed, or use z.infer
type LoginSchemaType = z.infer<typeof LoginSchema>;
type ValidateTokenSchemaType = z.infer<typeof ValidateTokenSchema>;

export default router; 