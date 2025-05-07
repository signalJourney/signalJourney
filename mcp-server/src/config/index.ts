import path from 'path';

import * as dotenv from 'dotenv';
import { z } from 'zod';

// import { getLogger } from '@/utils/logger'; // Removed unused import

// const logger = getLogger('Config'); // Removed unused logger

// Load .env file from the project root where mcp-server is located
// Adjust the path if your .env file is located elsewhere relative to this config file's execution.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  MCP_SERVER_NAME: z.string().default('MCP Server'),
  MCP_SERVER_VERSION: z.string().default('0.1.0'),
  ENABLE_STDIO_TRANSPORT: z.string().transform(val => val === 'true').default('false'),
  CORS_ORIGIN: z.string().default('*'),

  // Logging
  LOG_LEVEL: z.string().default('info'),
  LOG_DIR: z.string().default('./logs'),

  // Security
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('1h'), 
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  BLACKLIST_PRUNE_INTERVAL: z.coerce.number().default(60 * 60 * 1000),

  // Mock Auth
  MOCK_AUTH_USERNAME: z.string().default('testuser'),
  MOCK_AUTH_PASSWORD: z.string().default('password'),

  // Database
  MONGO_URI: z.string().url().default('mongodb://localhost:27017/signaljourney_mcp'),
});

// Load environment variables
dotenv.config();

let config: z.infer<typeof envSchema>;

try {
  config = envSchema.parse(process.env);
  console.log('Configuration loaded successfully:', 
    {
        NODE_ENV: config.NODE_ENV,
        PORT: config.PORT,
        MCP_SERVER_NAME: config.MCP_SERVER_NAME,
        LOG_LEVEL: config.LOG_LEVEL
        // Avoid logging secrets
    }
  );
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Configuration validation failed:', error.errors);
  } else {
    console.error('Failed to load configuration:', error);
  }
  process.exit(1);
}

export default {
  env: config.NODE_ENV,
  server: {
    port: config.PORT,
    mcpServerName: config.MCP_SERVER_NAME,
    mcpServerVersion: config.MCP_SERVER_VERSION,
    enableStdioTransport: config.ENABLE_STDIO_TRANSPORT,
    corsOptions: {
        origin: config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN.split(','),
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id'],
        credentials: true,
    },
    nodeEnv: config.NODE_ENV,
  },
  logging: {
    level: config.LOG_LEVEL,
    logDir: config.LOG_DIR,
  },
  security: {
    jwtSecret: config.JWT_SECRET,
    jwtExpiresIn: config.JWT_EXPIRES_IN,
    rateLimitWindowMs: config.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: config.RATE_LIMIT_MAX_REQUESTS,
    blacklistPruneInterval: config.BLACKLIST_PRUNE_INTERVAL,
  },
  auth: {
    mockUser: {
      username: config.MOCK_AUTH_USERNAME,
      password: config.MOCK_AUTH_PASSWORD,
    }
  },
  db: {
    mongoUri: config.MONGO_URI,
  }
}; 