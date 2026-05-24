/**
 * Pino logger with PII deny-list redaction. Never relies on dev discipline
 * to keep PII out of logs — the redactor is loaded at construction.
 */
import pino, { type Logger } from 'pino';
import { env } from './env';

const REDACT_PATHS = [
  // Headers
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-api-key-secret"]',
  // Common PII keys in request/response bodies
  '*.password',
  '*.email',
  '*.phone',
  '*.givenName',
  '*.familyName',
  '*.fullName',
  '*.dob',
  '*.ssn',
  '*.taxId',
  '*.cardNumber',
  '*.cvv',
  '*.accountNumber',
  '*.routingNumber',
  // Nested
  '*.donor.*',
  '*.lead.email',
  '*.lead.phone',
  '*.lead.givenName',
  '*.lead.familyName',
];

let _logger: Logger | undefined;

export function logger(): Logger {
  if (!_logger) {
    _logger = pino({
      level: env().LOG_LEVEL,
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      transport:
        env().NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
          : undefined,
    });
  }
  return _logger;
}
