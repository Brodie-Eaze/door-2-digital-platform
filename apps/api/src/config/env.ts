/**
 * Environment variable validation — fail-fast at startup.
 *
 * Every required variable is validated with Zod. Missing or malformed values
 * throw before the Fastify instance is created. This prevents a half-started
 * server that 500s on the first request because a secret was misnamed.
 */
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  AWS_REGION: z.string().default('us-east-1'),

  // HTTP
  PORT: z.coerce.number().int().default(3010),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z
    .string()
    .default(
      'http://localhost:3011,http://localhost:3012,https://d2d-production-1fab.up.railway.app',
    ),

  // Database + Redis
  DATABASE_URL: z.string().url(),
  DATABASE_REPLICA_URL: z.string().url().optional(),
  REDIS_URL: z.string().url(),

  // Encryption / PII (hex, 32 bytes = 64 chars)
  PII_ENCRYPTION_KEY: z.string().length(64),
  PII_HASH_SECRET: z.string().min(32),
  PII_SEARCH_KEY: z.string().min(32),
  AUDIT_CHAIN_SECRET: z.string().min(32),
  KMS_DEV_SECRET: z.string().length(64).optional(),
  AWS_KMS_KEY_ARN: z.string().optional(),
  // PII vault — Agent 15: dev "KMS" key wraps per-row DEKs; SIV key
  // produces deterministic search digests. 32 bytes base64 = ~44 chars.
  // Production replaces both with AWS KMS-backed values.
  PII_KMS_KEY: z.string().min(40),
  PII_SIV_KEY: z.string().min(40),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_WS_TICKET_SECRET: z.string().min(32),
  CSRF_SIGNING_SECRET: z.string().min(32),
  OAUTH_STATE_SECRET: z.string().min(32),
  MFA_STEP_UP_SECRET: z.string().min(32),
  API_TOKEN_HASH_SECRET: z.string().min(32),
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_ORIGIN: z.string().url().default('http://localhost:3011'),

  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),
  COGNITO_REGION: z.string().default('us-east-1'),

  OKTA_SAML_METADATA_URL: z.string().url().optional(),
  // SAML SSO (enterprise / Pilot-Charlie). Public origin of THIS API — used to
  // derive the SP entityId + ACS callback URL published in SP metadata and sent
  // to the IdP. Defaults to local dev; set to the real api origin in each env.
  // RelayState is signed with the existing OAUTH_STATE_SECRET (no new secret).
  SAML_SP_BASE_URL: z.string().url().default('http://localhost:3010'),

  // Payment sandbox: when 'true', POST /v1/payments/tokenize is available for
  // server-side card tokenisation (dev / CI only — never in production).
  D2D_PAYMENT_SANDBOX: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  // MiCamp (US)
  MICAMP_API_KEY: z.string().optional(),
  MICAMP_API_SECRET: z.string().optional(),
  MICAMP_GATEWAY_URL: z.string().url().optional(),
  MICAMP_WEBHOOK_SECRET: z.string().optional(),
  MICAMP_ISO_AGENT_ID: z.string().optional(),

  // Stripe (AU, SG)
  STRIPE_AU_SECRET_KEY: z.string().optional(),
  STRIPE_AU_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SG_SECRET_KEY: z.string().optional(),
  STRIPE_SG_WEBHOOK_SECRET: z.string().optional(),

  // Comms
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_US_MESSAGING_SID: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  // Mapping & Realtime
  MAPBOX_TOKEN: z.string().optional(),
  ABLY_API_KEY: z.string().optional(),

  // AI
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  REPLICATE_API_TOKEN: z.string().optional(),
  RUNWAY_API_KEY: z.string().optional(),

  // Object storage
  S3_BUCKET_AUDIT: z.string(),
  S3_BUCKET_ASSETS: z.string(),
  S3_BUCKET_EXPORTS: z.string(),

  // Workers — exactly one replica per region sets this to 'true'
  CRON_LEADER: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  // Observability
  SENTRY_DSN: z.string().url().optional(),
  DATADOG_API_KEY: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  PAGERDUTY_INTEGRATION_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export function env(): Env {
  if (!_env) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.error('Environment validation failed:\n', parsed.error.flatten().fieldErrors);
      process.exit(1);
    }
    _env = parsed.data;
  }
  return _env;
}
