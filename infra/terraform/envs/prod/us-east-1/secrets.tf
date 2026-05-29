/**
 * Secrets Manager SLOTS for every secret in the D2D env contract
 * (apps/api/src/config/env.ts).
 *
 * CRITICAL: these are EMPTY slots. No real value is in any .tf/.tfvars.
 * After `terraform apply`, the founder injects each value out-of-band:
 *   aws secretsmanager put-secret-value \
 *     --secret-id d2d/prod/<NAME> --secret-string '<value>'
 *
 * DATABASE_URL and REDIS_URL are NOT here — they are composed in main.tf
 * from the Aurora/Redis endpoints + Terraform-generated passwords.
 * DB_MASTER and REDIS_AUTH are also defined in main.tf (generated).
 *
 * Secret naming: d2d/<env>/<ENV_VAR_NAME> so the value maps 1:1 to the
 * container env var via the ECS task def `secrets` block.
 */

locals {
  # REQUIRED secrets (env.ts has no .optional()). The app fails fast at boot
  # if any is missing/malformed, so these must be injected before the service
  # is scaled up.
  required_secret_names = [
    # PII / crypto
    "PII_ENCRYPTION_KEY", # hex, 32 bytes (64 chars)
    "PII_HASH_SECRET",    # >=32 chars
    "PII_SEARCH_KEY",     # >=32 chars
    "AUDIT_CHAIN_SECRET", # >=32 chars
    "PII_KMS_KEY",        # >=40 chars (prod = KMS-backed wrap key material)
    "PII_SIV_KEY",        # >=40 chars
    # Auth
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "JWT_WS_TICKET_SECRET",
    "CSRF_SIGNING_SECRET",
    "OAUTH_STATE_SECRET",
    "MFA_STEP_UP_SECRET",
    "API_TOKEN_HASH_SECRET",
  ]

  # OPTIONAL secrets (env.ts marks .optional()). Slots created so they can be
  # filled when the integration goes live; the app boots without them.
  optional_secret_names = [
    # KMS / Cognito / Okta
    "KMS_DEV_SECRET",
    "AWS_KMS_KEY_ARN",
    "COGNITO_USER_POOL_ID",
    "COGNITO_CLIENT_ID",
    "OKTA_SAML_METADATA_URL",
    # MiCamp (US ISO)
    "MICAMP_API_KEY",
    "MICAMP_API_SECRET",
    "MICAMP_GATEWAY_URL",
    "MICAMP_WEBHOOK_SECRET",
    "MICAMP_ISO_AGENT_ID",
    # Stripe (AU/SG)
    "STRIPE_AU_SECRET_KEY",
    "STRIPE_AU_WEBHOOK_SECRET",
    "STRIPE_SG_SECRET_KEY",
    "STRIPE_SG_WEBHOOK_SECRET",
    # Comms
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_US_MESSAGING_SID",
    "RESEND_API_KEY",
    # Mapping / realtime / AI
    "MAPBOX_TOKEN",
    "ABLY_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "REPLICATE_API_TOKEN",
    "RUNWAY_API_KEY",
    # Observability
    "SENTRY_DSN",
    "DATADOG_API_KEY",
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "PAGERDUTY_INTEGRATION_KEY",
  ]

  all_app_secret_names = concat(local.required_secret_names, local.optional_secret_names)
}

module "app_secret" {
  source   = "../../../modules/secrets"
  for_each = toset(local.all_app_secret_names)

  name        = "d2d/${var.env}/${each.value}"
  description = "D2D ${var.env} ${each.value} — inject via aws secretsmanager put-secret-value."
  kms_key_arn = module.kms_redis_secrets.key_arn
  tags        = merge(local.tags, { SecretClass = contains(local.required_secret_names, each.value) ? "required" : "optional" })
}

# ── ECS task `secrets` mapping (env var name -> Secrets Manager ARN) ─────────
# Only REQUIRED secrets + composed connection strings are injected into the
# task. Optional integrations are added here as they go live (keeps the boot
# contract minimal; env.ts treats them as optional anyway).
locals {
  api_secret_arns = concat(
    [
      { name = "DATABASE_URL", valueFrom = module.secret_database_url.arn },
      { name = "REDIS_URL", valueFrom = module.secret_redis_url.arn },
    ],
    [
      for n in local.required_secret_names :
      { name = n, valueFrom = module.app_secret[n].arn }
    ],
  )

  # ARNs the ECS execution role must be allowed to read (for the secrets it
  # injects). Append-with-wildcard suffix handled in the IAM policy (ecs.tf).
  api_secret_arn_list = [for s in local.api_secret_arns : s.valueFrom]
}
