/**
 * RDS Proxy for Aurora PostgreSQL.
 *
 * The connection-pooling linchpin for 50,000 concurrent users.
 *
 * Without RDS Proxy the connection math fails: Aurora PostgreSQL max_connections
 * is (roughly) LEAST(DBInstanceClassMemory/9531392, 5000). For a db.serverless
 * instance at max ACU=128 (~256 GiB RAM equivalent budget), that yields ~5 000
 * connections.  50k users hitting 20+ Fargate tasks, each with a Prisma pool of
 * size 10, = 200+ raw connections per task × 20 tasks = 4 000+. With burst and
 * burst concurrency headroom the pool exhausts under heavy traffic.
 *
 * RDS Proxy multiplexes those 4 000+ application connections onto a stable pool
 * of 50–200 connections to Aurora (configurable via connection_borrow_timeout +
 * max_connections_percent). Applications see sub-ms proxy latency; Aurora never
 * sees more connections than the proxy target pool.
 *
 * Security hardening:
 *   - IAM authentication enabled (the proxy authenticates callers via IAM role,
 *     not a long-lived password in every task — the Secrets Manager secret with
 *     the master credentials is used ONLY by the proxy itself, not the app).
 *   - TLS required (require_tls = true). The app connects to the proxy endpoint
 *     with sslmode=require; Aurora enforces rds.force_ssl=1 on the proxy-Aurora
 *     leg too.
 *   - The proxy's IAM role is the only principal with access to the DB master
 *     secret. App tasks authenticate to the proxy via IAM db auth tokens
 *     (iam:GenerateDbAuthToken) — no plaintext password in the application.
 *   - Proxy lives in isolated subnets (same tier as Aurora). The app SG must
 *     allow 5432 egress to the proxy SG (handled in the env stack security group).
 */

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ── IAM role that the proxy uses to fetch the DB secret ──────────────────────
data "aws_iam_policy_document" "proxy_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "proxy" {
  name               = "${var.name}-rds-proxy"
  assume_role_policy = data.aws_iam_policy_document.proxy_assume.json
  tags               = var.tags
}

# Allow the proxy role to read the DB master secret and decrypt with the KMS CMK.
data "aws_iam_policy_document" "proxy_secrets" {
  statement {
    sid       = "ReadDbMasterSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.db_secret_arn]
  }
  statement {
    sid       = "DecryptDbSecretCmk"
    actions   = ["kms:Decrypt"]
    resources = [var.kms_key_arn]
  }
}

resource "aws_iam_role_policy" "proxy_secrets" {
  name   = "${var.name}-rds-proxy-secrets"
  role   = aws_iam_role.proxy.id
  policy = data.aws_iam_policy_document.proxy_secrets.json
}

# ── RDS Proxy ────────────────────────────────────────────────────────────────
resource "aws_db_proxy" "this" {
  name                   = "${var.name}-proxy"
  engine_family          = "POSTGRESQL"
  idle_client_timeout    = var.idle_client_timeout
  require_tls            = true
  role_arn               = aws_iam_role.proxy.arn
  vpc_security_group_ids = var.security_group_ids
  vpc_subnet_ids         = var.subnet_ids

  auth {
    auth_scheme               = "SECRETS"
    description               = "Aurora master credentials via Secrets Manager"
    iam_auth                  = "REQUIRED"
    secret_arn                = var.db_secret_arn
    client_password_auth_type = "POSTGRES_SCRAM_SHA_256"
  }

  tags = var.tags
}

# ── Proxy default target group → Aurora cluster ───────────────────────────────
resource "aws_db_proxy_default_target_group" "this" {
  db_proxy_name = aws_db_proxy.this.name

  connection_pool_config {
    connection_borrow_timeout    = var.connection_borrow_timeout
    max_connections_percent      = var.max_connections_percent
    max_idle_connections_percent = var.max_idle_connections_percent
  }
}

resource "aws_db_proxy_target" "this" {
  db_cluster_identifier = var.db_cluster_id
  db_proxy_name         = aws_db_proxy.this.name
  target_group_name     = aws_db_proxy_default_target_group.this.name
}
