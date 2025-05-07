import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { StreamableHTTPServerTransport, StdioServerTransport, AuthenticationContext } from '@modelcontextprotocol/sdk';
import config from '@/config';
import logger, { stream as morganStream } from '@/utils/logger';
import { initializeMcpServer, getMcpServer } from '@/core/server';
import { jwtAuthMiddleware, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { requestIdMiddleware } from '@/middleware/requestId.middleware';
import authRoutes from '@/routes/auth.routes';
import { McpApplicationError, McpErrorPayload } from '@/core/mcp-types'; 
import morgan from 'morgan'; 
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto'; // Imported randomUUID

let serverInstance: any; // To hold the http.Server instance for graceful shutdown
export let app: express.Express; // Export app for testing

async function startServer() {
  await initializeMcpServer();
  const mcpServerInstance = getMcpServer();

  app = express(); // Assign to the exported app

  // --- Core Middleware ---
  app.use(helmet());
  app.use(cors(config.server.corsOptions)); // Use CORS options from config
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestIdMiddleware); // Add request ID to res.locals

  // Morgan logging - uses res.locals.requestId set by requestIdMiddleware
  const morganFormat = config.server.nodeEnv === 'production' ? 'combined' : 'dev';
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
  app.all('/mcp', async (req: Request, res: Response) => { // Use base Request type
    try {
      const sdkContext: AuthenticationContext = {
        protocol: 'http',
        http: { req: req as express.Request, res: res as express.Response }, 
        auth: (req as AuthenticatedRequest).authInfo, // Pass populated authInfo
      };
      const transport = new StreamableHTTPServerTransport(mcpServerInstance, sdkContext);
      await transport.handler(req as express.Request, res as express.Response);
    } catch (error: any) {
      logger.error('Error in MCP HTTP transport handler:', { error, requestId: res.locals.requestId });
      if (!res.headersSent) {
        // Delegate to global error handler
        const mcpError = new McpApplicationError(error.message || 'MCP transport error', 'MCP_TRANSPORT_ERROR', error, 500);
        express().handle(mcpError, req, res, () => {}); // A bit of a hack to use global handler if possible
      }
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
      return next(err); // Delegate to default Express error handler if headers already sent
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
    const stdioTransport = new StdioServerTransport(mcpServerInstance, {
      protocol: 'stdio',
      // No specific auth for stdio in this basic setup, but could be added
    });
    stdioTransport.listen();
    logger.info('StdioServerTransport is listening.');
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