import dotenv from 'dotenv';
import path from 'path';
import logger from '@/utils/logger'; // Assuming alias @ is set up for src

// Load .env file from the project root where mcp-server is located
// Adjust the path if your .env file is located elsewhere relative to this config file's execution.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Helper function to validate and parse environment variables
const getEnvVar = (key: string, defaultValue?: string, isRequired = true): string => {
  const value = process.env[key];
  if (!value && isRequired && defaultValue === undefined) {
    logger.error(`Missing required environment variable: ${key}`);
    process.exit(1); // Exit if required variable is missing
  }
  return value || defaultValue || '';
};

const getEnvVarAsInt = (key: string, defaultValue?: number, isRequired = true): number => {
  const valueStr = getEnvVar(key, defaultValue?.toString(), isRequired);
  const valueInt = parseInt(valueStr, 10);
  if (isNaN(valueInt)) {
    logger.error(`Invalid integer value for environment variable: ${key}. Received: ${valueStr}`);
    if (isRequired && defaultValue === undefined) {
        process.exit(1);
    }
    return defaultValue as number; // This might be undefined if no defaultValue and not required
  }
  return valueInt;
};

const getEnvVarAsArray = (key: string, defaultValue?: string[], isRequired = true): string[] => {
  const valueStr = getEnvVar(key, defaultValue?.join(','), isRequired);
  if (!valueStr) return defaultValue || [];
  return valueStr.split(',').map(item => item.trim()).filter(item => item.length > 0);
};


// Define and export the configuration object
const config = {
  server: {
    port: getEnvVarAsInt('PORT', 3000),
    nodeEnv: getEnvVar('NODE_ENV', 'development'),
    mcpServerName: getEnvVar('MCP_SERVER_NAME', 'SignalJourney Analyzer'),
    mcpServerVersion: getEnvVar('MCP_SERVER_VERSION', '0.1.0'),
  },
  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
    dir: getEnvVar('LOG_DIR', path.join(process.cwd(), 'logs')),
  },
  security: {
    corsAllowedOrigins: getEnvVarAsArray('CORS_ALLOWED_ORIGINS', ['http://localhost:3001', 'http://localhost:8080']),
    jwtSecret: getEnvVar('JWT_SECRET', 'your-very-strong-and-secret-jwt-key'), // Ensure this is strong in production!
    jwtExpiresIn: getEnvVar('JWT_EXPIRES_IN', '1h'),
    rateLimitWindowMs: getEnvVarAsInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, false), // 15 minutes
    rateLimitMax: getEnvVarAsInt('RATE_LIMIT_MAX', 100, false), // Max 100 requests per window per IP
  },
  // Optional API keys - these are not required to run the server
  perplexity: {
    apiKey: getEnvVar('PERPLEXITY_API_KEY', '', false),
    model: getEnvVar('PERPLEXITY_MODEL', 'sonar-medium-online', false),
  },
  anthropic: {
    apiKey: getEnvVar('ANTHROPIC_API_KEY', '', false),
    model: getEnvVar('ANTHROPIC_MODEL', 'claude-3-opus-20240229', false),
  }
};

// Validate critical configurations post-load if necessary
if (config.server.nodeEnv === 'production' && config.security.jwtSecret === 'your-very-strong-and-secret-jwt-key') {
  logger.warn('CRITICAL SECURITY WARNING: JWT_SECRET is not set to a strong secret in production!');
}

export default config; 