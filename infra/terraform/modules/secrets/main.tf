/**
 * Secrets Manager secret SLOTS.
 *
 * EazePay's `secrets` module dir was empty (secrets were inlined per-env);
 * this is a clean reusable module for D2D.
 *
 * Two modes per secret, controlled by `managed_value`:
 *
 *   1. SLOT ONLY (managed_value == null) — DEFAULT.
 *      Terraform creates an empty secret resource. The founder injects the
 *      real value out-of-band via:
 *        aws secretsmanager put-secret-value --secret-id <name> --secret-string '...'
 *      Terraform never sees or stores the value. `ignore_changes` on the
 *      version means a later `terraform apply` will NOT clobber the injected
 *      value.
 *
 *   2. MANAGED VALUE (managed_value != null) — for values Terraform can
 *      legitimately compose from in-state, non-secret references plus already
 *      -generated secrets (e.g. DATABASE_URL built from the Aurora endpoint +
 *      the random_password DB secret, REDIS_URL from the Redis endpoint + auth
 *      token). No plaintext literal ever appears in source — only references.
 *
 * NEVER pass a hard-coded secret literal into `managed_value`.
 */

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

resource "aws_secretsmanager_secret" "this" {
  name                    = var.name
  description             = var.description
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = var.recovery_window_in_days
  tags                    = var.tags
}

# Managed value: only created when Terraform composes the value from
# in-state references (e.g. DATABASE_URL). Never a literal secret.
resource "aws_secretsmanager_secret_version" "managed" {
  count         = var.managed_value == null ? 0 : 1
  secret_id     = aws_secretsmanager_secret.this.id
  secret_string = var.managed_value
}

# Slot-only: seed an empty placeholder so the secret has a current version,
# then ignore future drift so out-of-band `put-secret-value` is authoritative.
resource "aws_secretsmanager_secret_version" "placeholder" {
  count         = var.managed_value == null && var.seed_placeholder ? 1 : 0
  secret_id     = aws_secretsmanager_secret.this.id
  secret_string = "PENDING_INJECTION"

  lifecycle {
    ignore_changes = [secret_string, version_stages]
  }
}
