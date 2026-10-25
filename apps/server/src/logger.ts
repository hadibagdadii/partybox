import { createHash, randomBytes } from 'node:crypto';
import { pino, type BaseLogger, type DestinationStream } from 'pino';

/** What the server logs through. Never pass player names, tokens, or roles. */
export type Logger = Pick<BaseLogger, 'info' | 'warn' | 'error'>;

/** JSON lines on stdout (or `destination`, for tests), shaped the way Railway parses them. */
export function createLogger(destination?: DestinationStream, level = 'info') {
  return pino(
    {
      level,
      base: undefined,
      messageKey: 'message',
      formatters: { level: (label) => ({ level: label }) },
      // Belt and braces: these fields should never be logged in the first place.
      redact: {
        paths: ['name', 'token', 'hostToken', 'playerToken', 'role', '*.name', '*.token'],
        censor: '[redacted]',
      },
    },
    destination,
  );
}

export const silentLogger: Logger = createLogger(undefined, 'silent');

const salt = randomBytes(16);

/** Short, per-process hash of a client IP: tells clients apart in logs without storing the IP. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(salt).update(ip).digest('hex').slice(0, 10);
}
