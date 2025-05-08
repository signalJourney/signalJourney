import { randomUUID } from 'crypto';

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import dotenv from 'dotenv';

import config from '@/config';
import logger, { stream as morganStream } from '@/utils/logger';
import { createMcpServer, getMcpServer } from '@/core/server';
import { jwtAuthMiddleware, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { requestIdMiddleware } from '@/middleware/requestId.middleware';
import authRoutes from '@/routes/auth.routes';
import { McpApplicationError } from '@/core/mcp-types';
import { connectDB, disconnectDB } from '@/core/db';
import tokenService from '@/services/token.service';

let serverInstance: any; // To hold the http.Server instance for graceful shutdown

async function startServer(): Promise<express.Express> {
  let app: express.Express; // Define app inside the function
  try {
    // Connect to Database first
    const dbConnected = await connectDB(); // connectDB now returns a boolean

    if (!dbConnected && process.env.NODE_ENV !== 'test') {
      // If DB connection fails and not in test mode, throw to prevent startup
      throw new Error('Database connection failed, server cannot start.');
    }
    if (!dbConnected && process.env.NODE_ENV === 'test') {
      logger.warn('Database connection failed in TEST environment. Server will continue starting for tests not requiring DB.');
    }

    // Initialize MCP Server
    const mcpServer = await createMcpServer();

    app = express();

    // --- Core Middleware ---
    app.use(helmet());
    app.use(cors(config.server.corsOptions)); // Use CORS options from config
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(requestIdMiddleware); // Add request ID to res.locals

    // Morgan logging - uses res.locals.requestId set by requestIdMiddleware
    // const morganFormat = config.server.nodeEnv === 'production' ? 'combined' : 'dev'; // Removed morganFormat
    // Morgan token for requestId. Morgan's req is http.IncomingMessage, res is http.ServerResponse.
    morgan.token('id', (req: Request, res: Response) => res.locals.requestId || '-'); 
    app.use(morgan(`:id :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"`, { stream: morganStream }));

    // Apply JWT authentication middleware globally. It populates req.authInfo if token is valid.
    app.use(jwtAuthMiddleware);

    // Rate Limiting Middleware
    const apiLimiter = rateLimit({
      windowMs: config.security.rateLimitWindowMs, 
      max: config.security.rateLimitMaxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response, next: NextFunction, options) => {
        // Pass a structured error to the global error handler
        next(new McpApplicationError(
          options.message || 'Too many requests, please try again later.',
          'RATE_LIMIT_EXCEEDED',
          { currentRate: options.max, window: `${options.windowMs / 1000}s` },
          options.statusCode
        ));
      },
      keyGenerator: (req: Request) => req.ip || randomUUID(), // Use base Request type
    });
    app.use('/mcp', apiLimiter);
    app.use('/auth', apiLimiter, authRoutes);

    // --- Setup Transports --- 
    const transports: any[] = [];
    
    // Create a handler function for token authentication
    const handleTokenAuthentication = async (token: string | undefined): Promise<any> => {
      if (!token) return { isAuthenticated: false };
      try {
        const decoded = tokenService.verifyToken(token);
        if (!decoded) return { isAuthenticated: false };
        return { 
          isAuthenticated: true,
          token: token,
          scopes: decoded.scopes || [],
          extra: decoded 
        };
      } catch (error) {
        return { isAuthenticated: false };
      }
    };
    
    // Create the HTTP transport 
    const httpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID()
    });
    
    // We'll handle auth manually in our Express route
    transports.push(httpTransport);

    // --- MCP Endpoint ---
    app.post('/mcp', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const requestBody = req.body;
      const mcpSessionId = req.headers['mcp-session-id'] as string | undefined;
      const authContext = req.authInfo ? { 
        isAuthenticated: true,
        token: req.headers.authorization?.split(' ')?.[1],
        scopes: req.authInfo.scopes,
        extra: req.authInfo 
      } : { isAuthenticated: false };

      try {
        const requestId = req.res?.locals?.requestId || req.headers['x-request-id'] || randomUUID();
        await httpTransport.handleRequest(requestBody, res, { 
          authContext,
          requestId: requestId,
          sessionId: mcpSessionId 
        });
      } catch (error) {
        next(error); 
      }
    });

    // ... (Auth routes) ...
    app.use('/auth', authRoutes);

    // ... (Stdio Transport setup)
    if (config.server.enableStdioTransport) {
      const stdioTransport = new StdioServerTransport(process.stdin, process.stderr); // Use stderr for logs
      transports.push(stdioTransport);
      logger.info('Stdio transport enabled.');
    }

    // Connect transports to the server
    for (const transport of transports) {
      await mcpServer.connect(transport);
    }
    logger.info('MCP transports connected.');

    // --- Global Error Handler ---
    // This MUST be the last middleware registered.
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      const requestId = res.locals.requestId || 'unknown';
      logger.error('[GlobalErrorHandler]', { error: err, message: err.message, requestId });

      if (err instanceof McpApplicationError) {
        return res.status(err.statusCode || 500).json({
          code: err.code,
          message: err.message,
          details: err.details,
          requestId,
        });
      } 
      // McpValidationError should be caught by the route-specific validation middleware
      // but if it somehow reaches here, handle it.
      if (err instanceof ZodError) { // Check for ZodError directly
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: err.errors.map(e => ({ path: e.path, message: e.message })),
          requestId,
        });
      }
      
      // Handle other unexpected errors
      return res.status(500).json({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal server error occurred.',
        requestId,
      });
    });

    // --- Start HTTP Server ---
    const port = config.server.port;
    
    // Only start listening if not in test environment.
    // supertest handles server lifecycle for tests when app is passed to it.
    if (process.env.NODE_ENV !== 'test') {
      serverInstance = app.listen(port, () => {
        logger.info(`MCP Server '${config.server.mcpServerName}' v${config.server.mcpServerVersion} started.`);
        logger.info(`HTTP transport listening on http://localhost:${port}/mcp`);
        if (config.server.enableStdioTransport) {
          logger.info('STDIO transport also active.');
        }
      });
    } else {
      logger.info('Server configured for testing, HTTP listener not started by startServer.');
    }

    // Graceful shutdown (modified to handle serverInstance potentially not being set)
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        await disconnectDB(); // Disconnect DB first
        if (serverInstance) {
          serverInstance.close(() => {
            logger.info('HTTP server closed.');
            // Stdio transport close logic if needed
            process.exit(0);
          });
          // Force exit if graceful shutdown times out
          setTimeout(() => {
            logger.warn('Graceful shutdown timed out, forcing exit.');
            process.exit(1);
          }, 10000); 
        } else {
          logger.info('No active HTTP server to close by startServer. Exiting.');
          process.exit(0);
        }
      });
    });

    return app; // Return the initialized app

  } catch (error) {
    logger.error('Failed to start server:', error);
    await disconnectDB(); // Ensure DB disconnects on startup failure
    // Do not exit process in test environment to allow tests to run/fail gracefully
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    // Rethrow or return a specific error/null for tests to handle
    throw error; 
  }
}

// Call startServer only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(error => {
    // Log error - already done inside startServer catch block
    // logger.error('Failed to start MCP server from global scope:', error);
    // process.exit(1); // Already handled in startServer catch block
  });
}

// Export the startServer function itself for tests to call
export { startServer }; 