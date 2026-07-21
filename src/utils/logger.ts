export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFormat = 'json' | 'pretty';
export type LogContext = Record<string, unknown>;

type LoggerOptions = {
  level?: LogLevel;
  format?: LogFormat;
  write?: (level: LogLevel, line: string) => void;
};

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};
const sensitiveKey = /token|secret|password|authorization|credential/i;

export function createLogger(options: LoggerOptions = {}) {
  const level = options.level ?? parseLogLevel(process.env.LOG_LEVEL);
  const format = options.format ?? parseLogFormat(process.env.LOG_FORMAT);
  const write = options.write ?? defaultWrite;

  const emit = (
    entryLevel: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown,
  ): void => {
    if (levelPriority[entryLevel] < levelPriority[level]) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level: entryLevel,
      message: redactSensitiveValues(message),
      ...(context ? { context: sanitize(context) } : {}),
      ...(error !== undefined ? { error: serializeError(error) } : {}),
    };

    write(entryLevel, format === 'json' ? JSON.stringify(entry) : formatPretty(entry));
  };

  return {
    debug: (message: string, context?: LogContext) => emit('debug', message, context),
    info: (message: string, context?: LogContext) => emit('info', message, context),
    warn: (message: string, context?: LogContext) => emit('warn', message, context),
    error: (message: string, error?: unknown, context?: LogContext) => (
      emit('error', message, context, error)
    ),
  };
}

export const logger = createLogger();

function parseLogLevel(value: string | undefined): LogLevel {
  return value === 'debug' || value === 'warn' || value === 'error' ? value : 'info';
}

function parseLogFormat(value: string | undefined): LogFormat {
  if (value === 'json' || value === 'pretty') return value;
  return process.env.NODE_ENV === 'production' ? 'json' : 'pretty';
}

function defaultWrite(level: LogLevel, line: string): void {
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function formatPretty(entry: {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: unknown;
  error?: unknown;
}): string {
  const details = [entry.context, entry.error]
    .filter((value) => value !== undefined)
    .map((value) => JSON.stringify(value))
    .join(' ');
  return `[${entry.timestamp}] ${entry.level.toUpperCase().padEnd(5)} ${entry.message}${details ? ` ${details}` : ''}`;
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return sanitize({
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    });
  }
  return sanitize(error);
}

function sanitize(value: unknown, key = '', seen = new WeakSet<object>()): unknown {
  if (sensitiveKey.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return redactSensitiveValues(value);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return String(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => sanitize(item, key, seen));

  const sanitized: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    sanitized[childKey] = sanitize(childValue, childKey, seen);
  }
  return sanitized;
}

function redactSensitiveValues(value: string): string {
  let redacted = value;
  for (const [key, secret] of Object.entries(process.env)) {
    if (sensitiveKey.test(key) && secret && secret.length >= 6) {
      redacted = redacted.split(secret).join('[REDACTED]');
    }
  }
  return redacted;
}
