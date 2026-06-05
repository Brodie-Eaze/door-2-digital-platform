/**
 * D2D US production — data + network plane composition.
 *
 *   data sources -> KMS CMKs -> S3 (audit/assets/exports) -> VPC + SGs
 *   -> generated DB/Redis passwords (Secrets Manager) -> Aurora -> Redis
 *   -> composed DATABASE_URL / REDIS_URL secrets.
 *
 * Compute (ECR / ECS / ALB / IAM) lives in ecs.tf; all individual secret
 * slots live in secrets.tf.
 */

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name = var.name_prefix
  tags = {
    Project   = "d2d"
    Env       = var.env
    Region    = var.region
    Owner     = var.owner
    ManagedBy = "terraform"
  }

  account_root = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"

  # Bucket names are globally unique; suffix with account id to avoid clashes.
  bucket_suffix = data.aws_caller_identity.current.account_id
}

# ── KMS CMKs (one per data class) ────────────────────────────────────────────
module "kms_rds" {
  source             = "../../../modules/kms"
  name               = "${local.name}-rds"
  data_class         = "rds"
  alias              = "alias/${local.name}-rds"
  key_admins         = var.kms_key_admin_arns
  service_principals = ["rds.amazonaws.com"]
  tags               = local.tags
}

module "kms_redis_secrets" {
  source     = "../../../modules/kms"
  name       = "${local.name}-redis-secrets"
  data_class = "redis-secrets"
  alias      = "alias/${local.name}-redis-secrets"
  key_admins = var.kms_key_admin_arns
  service_principals = [
    "elasticache.amazonaws.com",
    "secretsmanager.amazonaws.com",
    "logs.${var.region}.amazonaws.com",
  ]
  tags = local.tags
}

module "kms_s3_audit" {
  source             = "../../../modules/kms"
  name               = "${local.name}-s3-audit"
  data_class         = "s3-audit"
  alias              = "alias/${local.name}-s3-audit"
  key_admins         = var.kms_key_admin_arns
  service_principals = ["s3.amazonaws.com", "delivery.logs.amazonaws.com"]
  tags               = local.tags
}

# ── S3 buckets ───────────────────────────────────────────────────────────────
# Audit: Object Lock COMPLIANCE (write-once, undeletable for retention),
# also receives VPC flow logs.
module "s3_audit" {
  source                             = "../../../modules/s3-bucket"
  name                               = "${local.name}-audit-${local.bucket_suffix}"
  kms_key_arn                        = module.kms_s3_audit.key_arn
  object_lock_enabled                = true
  object_lock_mode                   = "COMPLIANCE"
  object_lock_default_retention_days = 2555 # ~7 years
  allow_flow_logs                    = true
  tags                               = merge(local.tags, { DataClass = "audit" })
}

module "s3_assets" {
  source      = "../../../modules/s3-bucket"
  name        = "${local.name}-assets-${local.bucket_suffix}"
  kms_key_arn = module.kms_s3_audit.key_arn
  tags        = merge(local.tags, { DataClass = "assets" })
}

module "s3_exports" {
  source                      = "../../../modules/s3-bucket"
  name                        = "${local.name}-exports-${local.bucket_suffix}"
  kms_key_arn                 = module.kms_s3_audit.key_arn
  lifecycle_expire_after_days = 90 # exports are transient; auto-expire
  tags                        = merge(local.tags, { DataClass = "exports" })
}

# ── Network ──────────────────────────────────────────────────────────────────
module "network" {
  source              = "../../../modules/network"
  name                = local.name
  cidr_block          = var.vpc_cidr
  azs                 = var.azs
  flow_log_bucket_arn = module.s3_audit.bucket_arn
  tags                = local.tags
}

# ── Security groups ──────────────────────────────────────────────────────────
# ALB: 80/443 from internet.
resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "ALB ingress (HTTP/HTTPS from internet)"
  vpc_id      = module.network.vpc_id

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTP (redirects to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    description = "All egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = merge(local.tags, { Name = "${local.name}-alb" })
}

# App (Fargate tasks): ingress from ALB only.
resource "aws_security_group" "app" {
  name        = "${local.name}-app"
  description = "API tasks; ingress from ALB only"
  vpc_id      = module.network.vpc_id

  ingress {
    description     = "From ALB"
    from_port       = var.api_container_port
    to_port         = var.api_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    description = "All egress (NAT/VPCE)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = merge(local.tags, { Name = "${local.name}-app" })
}

# RDS Proxy SG — inline rules deliberately empty to break the circular
# dependency (proxy SG ↔ aurora SG each reference the other).
# Rules are attached below via aws_security_group_rule resources.
resource "aws_security_group" "rds_proxy" {
  name        = "${local.name}-rds-proxy"
  description = "RDS Proxy; ingress 5432 from app SG; egress 5432 to Aurora SG"
  vpc_id      = module.network.vpc_id
  tags        = merge(local.tags, { Name = "${local.name}-rds-proxy" })

  lifecycle {
    create_before_destroy = true
  }
}

# Aurora SG — inline rules empty for the same reason.
resource "aws_security_group" "aurora" {
  name        = "${local.name}-aurora"
  description = "Aurora; ingress 5432 from RDS Proxy SG only"
  vpc_id      = module.network.vpc_id
  tags        = merge(local.tags, { Name = "${local.name}-aurora" })

  lifecycle {
    create_before_destroy = true
  }
}

# Proxy ← app: allow app tasks to reach the proxy on 5432.
resource "aws_security_group_rule" "proxy_ingress_from_app" {
  type                     = "ingress"
  description              = "Postgres from app tasks"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds_proxy.id
  source_security_group_id = aws_security_group.app.id
}

# Proxy → Aurora: proxy egresses 5432 to Aurora.
resource "aws_security_group_rule" "proxy_egress_to_aurora" {
  type                     = "egress"
  description              = "Postgres to Aurora"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds_proxy.id
  source_security_group_id = aws_security_group.aurora.id
}

# Aurora ← proxy: Aurora accepts 5432 from the proxy only.
resource "aws_security_group_rule" "aurora_ingress_from_proxy" {
  type                     = "ingress"
  description              = "Postgres from RDS Proxy"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.aurora.id
  source_security_group_id = aws_security_group.rds_proxy.id
}

# Redis: 6379 from app SG only.
resource "aws_security_group" "redis" {
  name        = "${local.name}-redis"
  description = "Redis; ingress 6379 from app SG only"
  vpc_id      = module.network.vpc_id

  ingress {
    description     = "Redis from app"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  tags = merge(local.tags, { Name = "${local.name}-redis" })
}

# ── Enhanced Monitoring role for RDS ─────────────────────────────────────────
data "aws_iam_policy_document" "rds_monitoring_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rds_monitoring" {
  name               = "${local.name}-rds-monitoring"
  assume_role_policy = data.aws_iam_policy_document.rds_monitoring_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ── Generated datastore credentials (never literals) ─────────────────────────
resource "random_password" "db_master" {
  length  = 32
  special = false # Aurora master password forbids /, @, ", space
}

# Redis AUTH token: 16-128 chars, no problematic chars.
resource "random_password" "redis_auth" {
  length  = 48
  special = false
}

# DB master secret: {username, password} JSON consumed by the aurora module.
module "secret_db_master" {
  source        = "../../../modules/secrets"
  name          = "d2d/${var.env}/DB_MASTER"
  description   = "Aurora master credentials (password generated by Terraform)."
  kms_key_arn   = module.kms_redis_secrets.key_arn
  managed_value = jsonencode({ username = var.db_master_username, password = random_password.db_master.result })
  tags          = local.tags
}

# Redis AUTH secret: {password} JSON consumed by the redis module.
module "secret_redis_auth" {
  source        = "../../../modules/secrets"
  name          = "d2d/${var.env}/REDIS_AUTH"
  description   = "Redis AUTH token (generated by Terraform)."
  kms_key_arn   = module.kms_redis_secrets.key_arn
  managed_value = jsonencode({ password = random_password.redis_auth.result })
  tags          = local.tags
}

# ── Aurora PostgreSQL Serverless v2 ──────────────────────────────────────────
module "aurora" {
  source              = "../../../modules/aurora"
  name                = local.name
  engine_version      = var.aurora_engine_version
  database_name       = var.db_name
  subnet_ids          = module.network.isolated_subnet_ids
  kms_key_arn         = module.kms_rds.key_arn
  master_secret_arn   = module.secret_db_master.arn
  security_group_ids  = [aws_security_group.aurora.id]
  min_acu             = var.aurora_min_acu
  max_acu             = var.aurora_max_acu
  instance_count      = var.aurora_instance_count
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  tags                = local.tags
}

# ── RDS Proxy ────────────────────────────────────────────────────────────────
# Connection-pooling linchpin: multiplexes 4 000+ app connections onto a stable
# pool of ≤200 Aurora connections.  App tasks authenticate to the proxy via IAM
# db-auth tokens (no plaintext DB password in any task).
module "rds_proxy" {
  source             = "../../../modules/rds-proxy"
  name               = local.name
  db_cluster_id      = module.aurora.cluster_id
  db_secret_arn      = module.secret_db_master.arn
  kms_key_arn        = module.kms_rds.key_arn
  subnet_ids         = module.network.isolated_subnet_ids
  security_group_ids = [aws_security_group.rds_proxy.id]

  # Pool sizing: 100% of Aurora max_connections available to the proxy,
  # idle half released.  Tune these after load testing.
  max_connections_percent      = var.rds_proxy_max_connections_percent
  max_idle_connections_percent = 50
  connection_borrow_timeout    = 120

  tags = local.tags
}

# ── ElastiCache Redis ────────────────────────────────────────────────────────
module "redis" {
  source             = "../../../modules/redis"
  name               = local.name
  subnet_ids         = module.network.isolated_subnet_ids
  security_group_ids = [aws_security_group.redis.id]
  node_type          = var.redis_node_type
  replicas           = var.redis_replicas
  kms_key_arn        = module.kms_redis_secrets.key_arn
  auth_secret_arn    = module.secret_redis_auth.arn
  tags               = local.tags
}

# ── Composed connection-string secrets (from in-state refs, no literals) ─────
# DATABASE_URL: routes through RDS Proxy (not direct Aurora).
# IAM auth is REQUIRED on the proxy; the app must use iam:GenerateDbAuthToken
# (the task role already has rds-db:connect permission — wired in ecs.tf).
# sslmode=require — the proxy enforces TLS on the client leg; Aurora enforces
# rds.force_ssl=1 on the proxy→Aurora leg.
module "secret_database_url" {
  source      = "../../../modules/secrets"
  name        = "d2d/${var.env}/DATABASE_URL"
  description = "Postgres connection string via RDS Proxy endpoint (IAM auth). Proxy -> Aurora."
  kms_key_arn = module.kms_redis_secrets.key_arn
  managed_value = format(
    "postgresql://%s:%s@%s:%s/%s?sslmode=require",
    var.db_master_username,
    random_password.db_master.result,
    module.rds_proxy.proxy_endpoint,
    module.aurora.cluster_port,
    var.db_name,
  )
  tags = local.tags
}

# REDIS_URL: rediss:// (TLS) with AUTH token.
module "secret_redis_url" {
  source      = "../../../modules/secrets"
  name        = "d2d/${var.env}/REDIS_URL"
  description = "Redis connection string composed from ElastiCache endpoint + generated AUTH token."
  kms_key_arn = module.kms_redis_secrets.key_arn
  managed_value = format(
    "rediss://default:%s@%s:%s",
    random_password.redis_auth.result,
    module.redis.primary_endpoint,
    module.redis.port,
  )
  tags = local.tags
}
