/**
 * Aurora PostgreSQL Serverless v2 cluster for Door 2 Digital.
 *
 * Forked from EazePay's `aurora` module and adapted from provisioned
 * (db.r6g.large) to Serverless v2 (instance_class = db.serverless) per the
 * D2D master plan — "real RDS from Day 1, no later migration drama," with
 * autoscaling ACUs so a low-traffic launch stays cheap.
 *
 * Hard requirements honoured:
 *   - engine_version 16.x (default 16.4).
 *   - KMS-encrypted at rest with a dedicated CMK.
 *   - rds.force_ssl = 1 via a custom cluster parameter group (TLS enforced).
 *   - In-region automated backups + 35-day PITR. (No cross-region replica;
 *     D2D US data stays in us-east-1 per plan §6.)
 *   - IAM database authentication enabled.
 *   - Placed in isolated subnets, deletion protection on.
 *
 * PostGIS: NOT enabled here. The extension is created at runtime via the
 * bootstrap SQL hook (see env stack + README) before Prisma migrations apply
 * the geography columns. No shared_preload_libraries entry is required for
 * PostGIS, so the default parameter group needs no extra preload config.
 *
 * Master username + password come from a Secrets Manager secret created by
 * the caller (generated via random_password — never a literal).
 */

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-aurora"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

# Custom cluster parameter group to enforce TLS (rds.force_ssl = 1).
resource "aws_rds_cluster_parameter_group" "this" {
  name        = "${var.name}-aurora-pg16"
  family      = var.parameter_group_family
  description = "${var.name} Aurora PostgreSQL 16 — TLS enforced"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  # log slow statements (>1s) to CloudWatch for the reliability-engineer.
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  tags = var.tags
}

data "aws_secretsmanager_secret_version" "master" {
  secret_id = var.master_secret_arn
}

resource "aws_rds_cluster" "this" {
  cluster_identifier                  = "${var.name}-aurora"
  engine                              = "aurora-postgresql"
  engine_mode                         = "provisioned" # required for Serverless v2
  engine_version                      = var.engine_version
  database_name                       = var.database_name
  master_username                     = jsondecode(data.aws_secretsmanager_secret_version.master.secret_string)["username"]
  master_password                     = jsondecode(data.aws_secretsmanager_secret_version.master.secret_string)["password"]
  db_subnet_group_name                = aws_db_subnet_group.this.name
  db_cluster_parameter_group_name     = aws_rds_cluster_parameter_group.this.name
  vpc_security_group_ids              = var.security_group_ids
  storage_encrypted                   = true
  kms_key_id                          = var.kms_key_arn
  iam_database_authentication_enabled = true
  backup_retention_period             = var.backup_retention_period
  preferred_backup_window             = "03:00-04:00"
  preferred_maintenance_window        = "mon:04:00-mon:05:00"
  copy_tags_to_snapshot               = true
  enabled_cloudwatch_logs_exports     = ["postgresql"]
  deletion_protection                 = var.deletion_protection
  skip_final_snapshot                 = false
  final_snapshot_identifier           = "${var.name}-aurora-final"
  apply_immediately                   = false

  serverlessv2_scaling_configuration {
    min_capacity = var.min_acu
    max_capacity = var.max_acu
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [master_password]
  }
}

resource "aws_rds_cluster_instance" "this" {
  count                           = var.instance_count
  identifier                      = "${var.name}-aurora-${count.index}"
  cluster_identifier              = aws_rds_cluster.this.id
  instance_class                  = "db.serverless"
  engine                          = aws_rds_cluster.this.engine
  engine_version                  = aws_rds_cluster.this.engine_version
  db_subnet_group_name            = aws_db_subnet_group.this.name
  performance_insights_enabled    = true
  performance_insights_kms_key_id = var.kms_key_arn
  monitoring_interval             = 60
  monitoring_role_arn             = var.monitoring_role_arn
  tags                            = var.tags
}
