import { randomUUID } from 'crypto';

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ServerRequest, AuthenticationContext } from '@modelcontextprotocol/sdk/types.js';
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
export let app: express.Express; // Export app for testing

async function startServer() {
  try {
    // Connect to Database first
    await connectDB();

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
    // ... (StreamableHTTP Transport Setup)
    const httpTransport = new StreamableHTTPServerTransport({
      serverInfoProvider: () => ({
          name: config.server.mcpServerName,
          version: config.server.mcpServerVersion,
          // capabilities: mcpServer.capabilities // Expose server capabilities
      }),
      authenticationProvider: async (token: string | undefined, request?: ServerRequest) => {
          if (!token) return { isAuthenticated: false };
          try {
              const decoded = tokenService.verifyToken(token);
              const authInfo: AuthenticationContext = {
                  isAuthenticated: true,
                  token: token,
                  scopes: decoded.scopes,
                  extra: decoded // Pass the full decoded payload as extra
              };
              return authInfo;
          } catch (error) {
              return { isAuthenticated: false };
          }
      },
      // sessionIdGenerator, onsessioninitialized if needed
    });
    transports.push(httpTransport);

    // --- MCP Endpoint ---
    app.post('/mcp', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const requestBody = req.body as ServerRequest;
      const mcpSessionId = req.headers['mcp-session-id'] as string | undefined;
      const authContext: AuthenticationContext = req.authInfo ? {
          isAuthenticated: true,
          token: req.headers.authorization?.split(' ')?.[1],
          scopes: req.authInfo.scopes,
          extra: req.authInfo 
      } : { isAuthenticated: false };

      try {
          await httpTransport.handleRequest(requestBody, res, { 
              authContext,
              requestId: req.id, 
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
    await mcpServer.connect(...transports);
    logger.info('MCP transports connected.');

    // --- Start Stdio Transport if enabled ---
    if (config.server.enableStdioTransport) {
      logger.info('Starting StdioServerTransport...');
      // StdioServerTransport constructor takes optional stdin/stdout, not server instance or options object directly.
      const stdioTransport = new StdioServerTransport(/* process.stdin, process.stdout */);
      await mcpServer.connect(stdioTransport); // Connect server to transport
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

  } catch (error) {
    logger.error('Failed to start server:', error);
    await disconnectDB(); // Ensure DB disconnects on startup failure
    process.exit(1);
  }
}

startServer().catch(error => {
  logger.error('Failed to start MCP server:', error);
  process.exit(1);
});

// Export the app instance for testing purposes after it's initialized
// This is a bit tricky with async startServer. A better way might be to have startServer return the app.
// For now, tests will import this and it should be populated after startServer() resolves in the main execution.
// Alternatively, tests can call startServer and then use the app. 