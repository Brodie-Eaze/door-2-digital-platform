/**
 * ElastiCache Redis 7 (cluster mode disabled, multi-AZ replica).
 *
 * Forked from EazePay's `redis` module. Used by apps/api for sessions,
 * idempotency keys, OTP storage, rate-limit counters, and BullMQ queues.
 * Encrypted at rest (CMK) + in transit (TLS), AUTH token from Secrets
 * Manager. Lives in isolated subnets — reachable only from the app SG.
 */

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name}-redis"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

data "aws_secretsmanager_secret_version" "auth" {
  secret_id = var.auth_secret_arn
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = "${var.name}-redis"
  description                = "${var.name} Redis (sessions/idempotency/otp/queues)"
  engine                     = "redis"
  engine_version             = var.engine_version
  node_type                  = var.node_type
  parameter_group_name       = var.parameter_group_name
  num_cache_clusters         = 1 + var.replicas
  port                       = 6379
  automatic_failover_enabled = var.replicas > 0
  multi_az_enabled           = var.replicas > 0
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = var.security_group_ids
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  kms_key_id                 = var.kms_key_arn
  auth_token                 = jsondecode(data.aws_secretsmanager_secret_version.auth.secret_string)["password"]
  snapshot_retention_limit   = var.snapshot_retention_limit
  maintenance_window         = "tue:05:00-tue:06:00"
  apply_immediately          = false
  tags                       = var.tags

  lifecycle {
    ignore_changes = [auth_token]
  }
}
