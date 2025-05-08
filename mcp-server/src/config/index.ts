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
  MONGO_URI_TEST_OVERRIDE: z.string().url().optional(),
});

// Load environment variables
dotenv.config();

let configInstance: z.infer<typeof envSchema>;

try {
  configInstance = envSchema.parse(process.env);
  console.log('Configuration loaded successfully:', 
    {
        NODE_ENV: configInstance.NODE_ENV,
        PORT: configInstance.PORT,
        MCP_SERVER_NAME: configInstance.MCP_SERVER_NAME,
        LOG_LEVEL: configInstance.LOG_LEVEL
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
  env: configInstance.NODE_ENV,
  server: {
    port: configInstance.PORT,
    mcpServerName: configInstance.MCP_SERVER_NAME,
    mcpServerVersion: configInstance.MCP_SERVER_VERSION,
    enableStdioTransport: configInstance.ENABLE_STDIO_TRANSPORT,
    corsOptions: {
        origin: configInstance.CORS_ORIGIN === '*' ? '*' : configInstance.CORS_ORIGIN.split(','),
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id'],
        credentials: true,
    },
    nodeEnv: configInstance.NODE_ENV,
  },
  logging: {
    level: configInstance.LOG_LEVEL,
    logDir: configInstance.LOG_DIR,
  },
  security: {
    jwtSecret: configInstance.JWT_SECRET,
    jwtExpiresIn: configInstance.JWT_EXPIRES_IN,
    rateLimitWindowMs: configInstance.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: configInstance.RATE_LIMIT_MAX_REQUESTS,
    blacklistPruneInterval: configInstance.BLACKLIST_PRUNE_INTERVAL,
  },
  auth: {
    mockUser: {
      username: configInstance.MOCK_AUTH_USERNAME,
      password: configInstance.MOCK_AUTH_PASSWORD,
    }
  },
  db: {
    mongoUri: (process.env.NODE_ENV === 'test' && configInstance.MONGO_URI_TEST_OVERRIDE) 
              ? configInstance.MONGO_URI_TEST_OVERRIDE 
              : configInstance.MONGO_URI,
  }
}; 