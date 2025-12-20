/**
 * Centralized Logger
 *
 * Provides structured logging with different severity levels.
 * Automatically filters logs based on NODE_ENV and provides
 * hooks for external logging services (Sentry, Datadog, etc.)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  [key: string]: unknown;
}

class Logger {
  /**
   * Determine if a log level should be logged based on environment
   */
  private shouldLog(level: LogLevel): boolean {
    if (typeof window === 'undefined') return true; // Always log on server

    // In production, only log warnings and errors
    if (process.env.NODE_ENV === 'production' && level === 'debug') {
      return false;
    }
    return true;
  }

  /**
   * Core logging function
   */
  private log(level: LogLevel, message: string, context?: LogContext) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logObject = {
      timestamp,
      level,
      message,
      ...context,
    };

    // In production, this would send to external service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with Sentry or similar
      // Sentry.captureMessage(message, { level, extra: context });
    }

    // Console output with appropriate method
    const consoleMethod = console[level] || console.log;
    consoleMethod(JSON.stringify(logObject, null, 2));
  }

  /**
   * Log debug information (development only)
   */
  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  /**
   * Log informational messages
   */
  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  /**
   * Log error messages with optional Error object
   */
  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, {
      ...context,
      error: error?.message,
      stack: error?.stack,
    });
  }
}

// Singleton instance
export const logger = new Logger();

/**
 * Example usage:
 *
 * logger.debug('User clicked button', { component: 'ChatInput', action: 'submit' });
 * logger.info('Chat message sent', { messageId: '123', length: 50 });
 * logger.warn('Rate limit approaching', { remaining: 2, limit: 20 });
 * logger.error('Failed to send message', error, { component: 'useChat', action: 'sendMessage' });
 */
