/**
 * Application logger using electron-log.
 * Writes to file + console. Log files stored in app userData.
 *
 * Usage:
 *   import { log } from './logger';
 *   log.info('App started');
 *   log.error('Something failed', error);
 */

let logger: any;

try {
  // electron-log v5+
  const electronLog = require('electron-log');
  logger = electronLog.default || electronLog;

  // Configure log levels and format
  if (logger.transports) {
    logger.transports.file.maxSize = 5 * 1024 * 1024; // 5MB max per log file
    logger.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';
    logger.transports.console.format = '[{h}:{i}:{s}] [{level}] {text}';
  }
} catch {
  // Fallback if electron-log not available (e.g., in tests)
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
    verbose: console.log,
  };
}

export const log = logger;
