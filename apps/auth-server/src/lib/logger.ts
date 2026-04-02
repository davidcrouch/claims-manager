/**
 * Structured logging via pino.
 *
 * - Development: pretty-printed, colorised console output via pino-pretty
 *   (matches chat app format: [HH:mm:ss.SSS] LEVEL (name/pid): message)
 * - Production: JSON to stdout for log aggregation
 */

import pino from 'pino';

export type Logger = {
  info: (obj: any, ...args: any[]) => void;
  warn: (obj: any, ...args: any[]) => void;
  error: (obj: any, ...args: any[]) => void;
  debug: (obj: any, ...args: any[]) => void;
  child: (bindings: Record<string, any>) => Logger;
};

export const LoggerType = {
  NODEJS: 'nodejs',
  BROWSER: 'browser',
  EDGE: 'edge',
} as const;

export type LoggerType = (typeof LoggerType)[keyof typeof LoggerType];

const isDev = process.env.NODE_ENV !== 'production';
const level =
  process.env.LOG_LEVEL ?? process.env.MOREZERO_LOG_LEVEL ?? (isDev ? 'debug' : 'info');

function buildTransport(): pino.TransportSingleOptions | undefined {
  if (isDev) {
    return {
      target: 'pino-pretty',
      options: { colorize: true },
    };
  }
  return undefined;
}

const transportConfig = buildTransport();

const rootLogger = pino(
  {
    level,
    name: 'auth-server',
  },
  transportConfig ? pino.transport(transportConfig) : undefined,
);

/**
 * Creates a child logger with the given name binding.
 * Used by createTelemetryLogger; output format matches chat app:
 * [HH:mm:ss.SSS] LEVEL (auth-server/pid): message
 *     key: "value"
 *     nested: { ... }
 */
export function createLogger(name: string, _type?: LoggerType): Logger {
  return rootLogger.child({ name }) as Logger;
}
