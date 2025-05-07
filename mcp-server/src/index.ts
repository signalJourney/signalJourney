import express from 'express';
import helmet from 'helmet';
import cors from 'cors'; // Import cors
import { StreamableHTTPServerTransport, StdioServerTransport, AuthenticationContext } from '@modelcontextprotocol/sdk';
import config from '@/config';
import logger, { stream as morganStream } from '@/utils/logger';
import { initializeMcpServer, getMcpServer } from '@/core/server';
import morgan from 'morgan'; // HTTP request logger middleware
import { requestIdMiddleware } from '@/middleware/requestId.middleware';
import { jwtAuthMiddleware, AuthenticatedRequest, AuthPayload } from '@/middleware/auth.middleware';
import rateLimit from 'express-rate-limit';
import { McpApplicationError } from '@/core/mcp-types';

async function startServer() {
  // Initialize MCP Server instance
  const mcpServer = initializeMcpServer();

  // Create Express app
  const app = express();

  // Trust proxy if behind one (e.g., Nginx, Heroku) for rate limiting and secure cookies
  app.set('trust proxy', 1); 

  // Apply Request ID middleware first
  app.use(requestIdMiddleware);

  // Security Middleware
  app.use(helmet());

  // CORS Middleware
  const corsOptions = {
    origin: config.security.corsAllowedOrigins, // Use configured origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
  };
  app.use(cors(corsOptions));
  logger.info(`CORS enabled for origins: ${config.security.corsAllowedOrigins.join(', ')}`);

  // Request Body Parsing Middleware
  app.use(express.json({ limit: '10mb' })); // Adjust limit as needed
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // HTTP Request Logging Middleware (Morgan)
  // Use 'combined' format for production and 'dev' for development
  const morganFormat = config.server.nodeEnv === 'production' ? 'combined' : 'dev';
  // Add custom token for requestId in Morgan
  morgan.token('id', (req: AuthenticatedRequest) => res.locals.requestId || '-');
  app.use(morgan(`:id :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"`, { stream: morganStream }));

  // Apply JWT authentication middleware globally. It populates req.authInfo if token is valid.
  app.use(jwtAuthMiddleware);

  // Rate Limiting Middleware - applied to /mcp and /auth routes (if an /auth route is added later)
  const apiLimiter = rateLimit({
    windowMs: config.security.rateLimitWindowMs,
    max: config.security.rateLimitMax,
    standardHeaders: 'draft-7', // Use recommended standard draft
    legacyHeaders: false, 
    message: {
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' },
    },
    keyGenerator: (req: AuthenticatedRequest) => req.ip || randomUUID(), // Fallback if IP is not available
  });
  app.use('/mcp', apiLimiter);
  // app.use('/auth', apiLimiter); // Example if auth routes are added

  // MCP StreamableHTTP Transport Endpoint
  app.all('/mcp', async (req: AuthenticatedRequest, res) => {
    try {
      // Pass authentication context from Express to MCP SDK transport
      // The SDK's StreamableHTTPServerTransport can accept a function to provide context.
      // For now, we assume the SDK transport or McpServer can access req.authInfo implicitly if needed or via a custom context provider.
      // A more explicit way would be to customize the transport if the SDK supports it, or pass it via the `execute` method options if possible.
      // The `sdkContext.auth` in the tool's execute method is the target for this.
      
      // Let's try to pass it via the options to connect, if the SDK supports custom context for transports
      // This is a hypothetical way to pass it, actual SDK mechanism might differ.
      // const transport = new StreamableHTTPServerTransport(req, res, { getAuthenticationContext: async () => req.authInfo as AuthenticationContext });
      const transport = new StreamableHTTPServerTransport(req, res, {
        getAuthenticationContext: async () => req.authInfo as AuthenticationContext | undefined,
      });

      await mcpServer.connect(transport);
    } catch (error) {
      logger.error('Error in MCP HTTP transport connection:', { error, requestId: res.locals.requestId });
      if (!res.headersSent) {
        res.status(500).json({ error: { code: 'MCP_TRANSPORT_ERROR', message: 'MCP transport connection error' }});
      }
    }
  });

  // Basic health check endpoint
  app.get('/health', (req: AuthenticatedRequest, res) => {
    res.status(200).json({
      status: 'UP',
      serverName: config.server.mcpServerName,
      version: config.server.mcpServerVersion,
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId,
    });
  });

  // Global Error Handler Middleware (Express specific)
  // This should be the last middleware
  app.use((err: any, req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const requestId = res.locals.requestId || 'unknown';
    logger.error(
      `Unhandled Express error: ${err.message}`,
      { 
        stack: config.server.nodeEnv === 'development' ? err.stack : undefined, 
        requestPath: req.path, 
        requestId, 
        errorCode: err.code, // Log our custom error code if present
        errorDetails: err.details 
      }
    );

    if (res.headersSent) {
      return next(err);
    }

    let statusCode = 500;
    let errorBody: any = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal server error occurred.',
        requestId,
      }
    };

    if (err instanceof McpApplicationError) {
      errorBody.error.code = err.code;
      errorBody.error.message = err.message;
      if (err.details) errorBody.error.details = err.details;

      switch (err.code) {
        case 'VALIDATION_ERROR': statusCode = 400; break;
        case 'AUTHENTICATION_REQUIRED': statusCode = 401; break;
        case 'AUTHENTICATION_FAILED': statusCode = 401; break; // e.g. invalid token
        case 'AUTHORIZATION_FAILED': statusCode = 403; break;
        case 'NOT_FOUND': statusCode = 404; break;
        default: statusCode = err.statusCode || 500; // Use status code from error if provided
      }
    }
    // For ZodErrors specifically if not wrapped in McpApplicationError (though McpServer should handle this)
    else if (err.name === 'ZodError' && err.issues) {
        statusCode = 400;
        errorBody.error.code = 'VALIDATION_ERROR';
        errorBody.error.message = 'Request validation failed';
        errorBody.error.details = err.issues;
    }
    
    res.status(statusCode).json(errorBody);
  });

  // Start HTTP server
  const server = app.listen(config.server.port, () => {
    logger.info(`HTTP Server listening on port ${config.server.port}`);
    logger.info(`MCP Server Name: ${config.server.mcpServerName}, Version: ${config.server.mcpServerVersion}`);
    logger.info(`Environment: ${config.server.nodeEnv}, Log Level: ${config.logging.level}`);
    logger.info(`Access health check at http://localhost:${config.server.port}/health`);
    logger.info(`MCP endpoint at http://localhost:${config.server.port}/mcp`);
  });

  // Handle server errors (e.g., EADDRINUSE)
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.syscall !== 'listen') {
      throw error;
    }
    switch (error.code) {
      case 'EACCES':
        logger.error(`Port ${config.server.port} requires elevated privileges`);
        process.exit(1);
        break;
      case 'EADDRINUSE':
        logger.error(`Port ${config.server.port} is already in use`);
        process.exit(1);
        break;
      default:
        throw error;
    }
  });

  // Stdio Transport (if enabled via command line argument, e.g., --stdio)
  if (process.argv.includes('--stdio')) {
    try {
      // For stdio, the McpServer itself handles the request loop after connect.
      // Authentication for stdio would need a custom mechanism if JWTs (HTTP-centric) aren't used.
      // E.g., first message could be an auth token, or it runs in a trusted environment.
      // For now, authInfo will be undefined for stdio tools unless a mechanism is added.
      const stdioTransport = new StdioServerTransport(); // No auth context passed here for now
      await mcpServer.connect(stdioTransport);
      logger.info('MCP Server connected via Stdio transport.');
    } catch (error) {
      logger.error('Failed to connect MCP Server via Stdio transport:', error);
    }
  }

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed.');
      // Potentially disconnect MCP transports if the SDK requires/provides it.
      // Example: getMcpServer().disconnectAll();
      logger.info('MCP server shutting down complete.');
      process.exit(0);
    });

    // Force shutdown if graceful shutdown fails after a timeout
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000); // 10 seconds
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

}

startServer().catch(error => {
  logger.error('Failed to start server:', { errorMessage: error.message, stack: error.stack });
  process.exit(1);
}); 