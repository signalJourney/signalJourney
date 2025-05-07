import express from 'express';
import helmet from 'helmet';
import cors from 'cors'; // Import cors
import { StreamableHTTPServerTransport, StdioServerTransport } from '@modelcontextprotocol/sdk';
import config from '@/config';
import logger, { stream as morganStream } from '@/utils/logger';
import { initializeMcpServer } from '@/core/server';
import morgan from 'morgan'; // HTTP request logger middleware

async function startServer() {
  // Initialize MCP Server instance
  const mcpServer = initializeMcpServer();

  // Create Express app
  const app = express();

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
  app.use(morgan(morganFormat, { stream: morganStream }));

  // MCP StreamableHTTP Transport Endpoint
  app.all('/mcp', async (req, res) => {
    try {
      const transport = new StreamableHTTPServerTransport(req, res);
      await mcpServer.connect(transport);
    } catch (error) {
      logger.error('Error in MCP HTTP transport connection:', error);
      if (!res.headersSent) {
        res.status(500).send('MCP transport connection error');
      }
    }
  });

  // Basic health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'UP',
      serverName: config.server.mcpServerName,
      version: config.server.mcpServerVersion,
      timestamp: new Date().toISOString(),
    });
  });

  // Global Error Handler Middleware (Express specific)
  // This should be the last middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error(`Unhandled Express error: ${err.message}`, { stack: err.stack, requestPath: req.path });
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      error: {
        message: err.message || 'Internal Server Error',
        // stack: config.server.nodeEnv === 'development' ? err.stack : undefined, // Optionally include stack in dev
      },
    });
  });

  // Start HTTP server
  const server = app.listen(config.server.port, () => {
    logger.info(`HTTP Server listening on port ${config.server.port}`);
    logger.info(`MCP Server Name: ${config.server.mcpServerName}, Version: ${config.server.mcpServerVersion}`);
    logger.info(`Environment: ${config.server.nodeEnv}, Log Level: ${config.logging.level}`);
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
      const stdioTransport = new StdioServerTransport();
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
      // mcpServer.disconnectAllTransports(); // If MCP SDK provides such a method
      logger.info('MCP transports disconnected.');
      // Perform any other cleanup here
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
  logger.error('Failed to start server:', error);
  process.exit(1);
}); 