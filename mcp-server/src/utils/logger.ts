import path from 'path';
import fs from 'fs';

import winston, { Logform } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// Determine if running in stdio mode
const isStdioMode = process.argv.includes('--stdio');

// Ensure log directory exists
const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

const level = (): string => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? (process.env.LOG_LEVEL || 'debug') : (process.env.LOG_LEVEL || 'warn');
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
  silly: 'gray'
};

winston.addColors(colors);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info: Logform.TransformableInfo) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info: Logform.TransformableInfo) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

const transportInstances = [];

if (isStdioMode) {
  // In stdio mode, console logs go to stderr to not interfere with stdout protocol messages
  transportInstances.push(new winston.transports.Console({
    format: consoleFormat,
    stderrLevels: Object.keys(levels), // Direct all levels to stderr
  }));
  // Optionally, reduce verbosity to console in stdio mode or rely on file logs
  // For example, only log 'warn' and 'error' to stderr in stdio mode:
  // transportInstances.push(new winston.transports.Console({
  //   format: consoleFormat,
  //   level: 'warn',
  //   stderrLevels: ['error', 'warn'], 
  // }));
} else {
  // Default console transport (writes to stdout for info/debug, stderr for error/warn by default based on level)
  transportInstances.push(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// File transports (always active)
transportInstances.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'server-errors-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'error',
    format: fileFormat, // Use non-colorized format for files
  })
);
transportInstances.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'server-combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: fileFormat, // Use non-colorized format for files
  })
);

const logger = winston.createLogger({
  level: level(),
  levels,
  // format: consoleFormat, // Default format for logger, individual transports can override
  transports: transportInstances,
  exitOnError: false, // do not exit on handled exceptions
});

// Morgan-compatible stream for HTTP request logging
// This will use the logger's configured transports (e.g., stderr in stdio mode)
export const stream = {
    write: (message: string): void => {
        logger.http(message.trim());
    },
};

export default logger; 