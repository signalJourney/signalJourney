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
import { initializeMcpServer, getMcpServer } from '@/core/server';
import { jwtAuthMiddleware, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { requestIdMiddleware } from '@/middleware/requestId.middleware';
import authRoutes from '@/routes/auth.routes';
import { McpApplicationError, McpErrorPayload } from '@/core/mcp-types'; 

let serverInstance: any; // To hold the http.Server instance for graceful shutdown
export let app: express.Express; // Export app for testing

async function startServer() {
  await initializeMcpServer();
  const mcpServerInstance = getMcpServer();

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

  // MCP StreamableHTTP Transport Endpoint
  app.all('/mcp', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // The transport is created per request or session, then connected.
      // For resumability, an eventStore would be used here, and session ID managed.
      // For simplicity now, creating a new one. Refer to SDK examples for session management.
      const transport = new StreamableHTTPServerTransport({
        // Basic options; refer to SDK examples for session ID generation, event store for resumability
        sessionIdGenerator: randomUUID, // Example generator
        // onsessioninitialized: (sessionId) => { logger.info(`HTTP Session initialized: ${sessionId}`); },
        // eventStore: myEventStore, // For resumability
      });

      // The AuthenticationContext is built by the transport or passed to connect if needed.
      // For StreamableHTTPServerTransport, it often derives it from req/res.
      // We pass authInfo from our middleware via the `connect` method's second arg if supported,
      // or ensure the transport can access it (e.g. if it uses req.authInfo itself).
      // The MCP server connect method takes the transport.
      // Authentication context is more about what the McpServer passes to tools.
      await mcpServerInstance.connect(transport); 
      
      // Pass the raw request body to handleRequest if it expects it
      // The `req.body` should already be parsed by `express.json()`
      await transport.handleRequest(req as express.Request, res as express.Response, req.body as ServerRequest);
    } catch (error: any) {
      logger.error('Error in MCP HTTP transport handler:', { error, requestId: res.locals.requestId });
      // Pass error to the global Express error handler
      next(error); // Changed to use next(error)
    }
  });

  // Basic health check endpoint
  app.get('/health', (req: Request, res: Response) => { // Use base Request type
    res.status(200).json({
      status: 'UP',
      serverName: config.server.mcpServerName,
      version: config.server.mcpServerVersion,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
    });
  });

  // Global Error Handler Middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => { // Use base Request, Response, NextFunction
    const requestId = res.locals.requestId || 'unknown';
    logger.error(
      `Unhandled Express error: ${err.message}`,
      { 
        stack: config.server.nodeEnv === 'development' ? err.stack : undefined, 
        requestPath: (req as AuthenticatedRequest).path, // req.path should be available on base Request too
        requestId, 
        errorCode: err.code, 
        errorDetails: err.details 
      }
    );

    if (res.headersSent) {
      // If headers already sent, delegate to the default Express error handler
      // This is important for streaming responses or if an error occurs mid-stream
      return next(err);
    }

    let statusCode = 500;
    let responseBody: McpErrorPayload = {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    };

    if (err instanceof McpApplicationError) {
      statusCode = err.statusCode || 500;
      responseBody = { code: err.code, message: err.message, details: err.details };
    } else if (err instanceof ZodError) { // Handle ZodErrors directly if they weren't wrapped
      statusCode = 400;
      responseBody = { 
        code: 'VALIDATION_ERROR', 
        message: 'Request validation failed', 
        details: err.issues 
      };
    } else if (err.name === 'UnauthorizedError') { // Example for express-jwt errors
        statusCode = 401;
        responseBody = { code: 'UNAUTHORIZED', message: err.message };
    }
    // Add more specific error type checks here if needed

    res.status(statusCode).json(responseBody);
  });

  // --- Start Stdio Transport if enabled ---
  if (config.server.enableStdioTransport) {
    logger.info('Starting StdioServerTransport...');
    // StdioServerTransport constructor takes optional stdin/stdout, not server instance or options object directly.
    const stdioTransport = new StdioServerTransport(/* process.stdin, process.stdout */);
    await mcpServerInstance.connect(stdioTransport); // Connect server to transport
    await stdioTransport.start(); // Call start() method
    logger.info('StdioServerTransport is listening (started).');
  }

  // --- Start HTTP Server ---
  const port = config.server.port;
  
  // Only start listening if not in test environment or if explicitly told to listen
  // This prevents EADDRINUSE errors when supertest starts its own server instance.
  if (config.server.nodeEnv !== 'test') {
    serverInstance = app.listen(port, () => {
      logger.info(`MCP Server '${config.server.mcpServerName}' v${config.server.mcpServerVersion} started.`);
      logger.info(`HTTP transport listening on http://localhost:${port}/mcp`);
      if (config.server.enableStdioTransport) {
        logger.info('STDIO transport also active.');
      }
    });
  } else {
    logger.info('Server configured for testing, HTTP listener not started by default.');
  }

  // Graceful shutdown (modified to handle serverInstance potentially not being set if in test and not listening)
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      if (serverInstance) {
        serverInstance.close(() => {
          logger.info('HTTP server closed.');
          if (config.server.enableStdioTransport && (getMcpServer() as any).stdioTransport?.close) {
              logger.info('Stdio transport closed.');
          }
          process.exit(0);
        });
        setTimeout(() => {
          logger.warn('Graceful shutdown timed out, forcing exit.');
          process.exit(1);
        }, 10000);
      } else {
        // If serverInstance is not defined (e.g., in test mode without listen), exit directly
        logger.info('No active HTTP server to close. Exiting.');
        process.exit(0);
      }
    });
  });

}

startServer().catch(error => {
  logger.error('Failed to start MCP server:', error);
  process.exit(1);
});

// Export the app instance for testing purposes after it's initialized
// This is a bit tricky with async startServer. A better way might be to have startServer return the app.
// For now, tests will import this and it should be populated after startServer() resolves in the main execution.
// Alternatively, tests can call startServer and then use the app. 