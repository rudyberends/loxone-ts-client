/**
 * Pluggable logging.
 *
 * The library has no hard dependency on any logging framework. By default it
 * logs nothing ({@link NoopLogger}). Pass your own {@link Logger} (or use
 * {@link ConsoleLogger}) via `LoxoneClientOptions.logger` to receive log output.
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/** Minimal structured logging interface. Implement this to bridge to your logger. */
export interface Logger {
  trace(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** A logger that discards everything. This is the default. */
export class NoopLogger implements Logger {
  trace(): void {}
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

const LEVEL_ORDER: Record<LogLevel, number> = { trace: 0, debug: 1, info: 2, warn: 3, error: 4 };

/**
 * A simple logger that writes to the console, filtered by a minimum level.
 * Useful for development; production consumers will typically supply their own.
 */
export class ConsoleLogger implements Logger {
  private readonly threshold: number;

  constructor(
    private readonly minLevel: LogLevel = 'info',
    private readonly prefix = '[loxone]',
  ) {
    this.threshold = LEVEL_ORDER[minLevel];
  }

  private write(level: LogLevel, message: string, args: unknown[]): void {
    if (LEVEL_ORDER[level] < this.threshold) return;
    const line = `${this.prefix} ${level.toUpperCase()} ${message}`;
    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    sink(line, ...args);
  }

  trace(message: string, ...args: unknown[]): void {
    this.write('trace', message, args);
  }
  debug(message: string, ...args: unknown[]): void {
    this.write('debug', message, args);
  }
  info(message: string, ...args: unknown[]): void {
    this.write('info', message, args);
  }
  warn(message: string, ...args: unknown[]): void {
    this.write('warn', message, args);
  }
  error(message: string, ...args: unknown[]): void {
    this.write('error', message, args);
  }
}
