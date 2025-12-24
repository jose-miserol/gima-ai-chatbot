import { vi } from 'vitest';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: unknown;
  timestamp: Date;
}

/**
 * In-Memory Logger Mock
 * Captures logs for verification without polluting test output.
 */
export class MockLogger {
  private logs: LogEntry[] = [];

  info = vi.fn((message: string, meta?: unknown) => this.log('info', message, meta));
  warn = vi.fn((message: string, meta?: unknown) => this.log('warn', message, meta));
  error = vi.fn((message: string, meta?: unknown) => this.log('error', message, meta));
  debug = vi.fn((message: string, meta?: unknown) => this.log('debug', message, meta));

  private log(level: LogLevel, message: string, meta?: unknown) {
    this.logs.push({
      level,
      message,
      meta,
      timestamp: new Date(),
    });
  }

  getLogs() {
    return this.logs;
  }

  clear() {
    this.logs = [];
    this.info.mockClear();
    this.warn.mockClear();
    this.error.mockClear();
    this.debug.mockClear();
  }
}

export const loggerMock = new MockLogger();
