/**
 * D2D US production — compute plane.
 *   ECR repo -> ECS cluster -> IAM (execution + task roles) -> ALB
 *   -> ECS Fargate service (apps/api) + one-off migration task def.
 */

# ── ECR ──────────────────────────────────────────────────────────────────────
module "ecr_api" {
  source = "../../../modules/ecr"
  name   = "d2d/api"
  tags   = local.tags
}

locals {
  api_image = "${module.ecr_api.repository_url}:${var.api_image_tag}"
}

# ── ECS cluster ──────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "this" {
  name = "${local.name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  configuration {
    execute_command_configuration {
      logging = "DEFAULT"
    }
  }

  tags = local.tags
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

# ── IAM: ECS task execution role (agent: pull image, fetch secrets, logs) ────
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api_execution" {
  name               = "${local.name}-api-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "api_execution_base" {
  role       = aws_iam_role.api_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow the execution role to read ONLY this service's injected secrets and
# decrypt with the secrets CMK (least privilege — not secretsmanager:*).
data "aws_iam_policy_document" "api_execution_secrets" {
  statement {
    sid       = "ReadInjectedSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = local.api_secret_arn_list
  }
  statement {
    sid       = "DecryptSecretsCmk"
    actions   = ["kms:Decrypt"]
    resources = [module.kms_redis_secrets.key_arn]
  }
}

resource "aws_iam_role_policy" "api_execution_secrets" {
  name   = "${local.name}-api-execution-secrets"
  role   = aws_iam_role.api_execution.id
  policy = data.aws_iam_policy_document.api_execution_secrets.json
}

# ── IAM: ECS task role (app runtime: S3 buckets, KMS, ECS Exec) ──────────────
resource "aws_iam_role" "api_task" {
  name               = "${local.name}-api-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = local.tags
}

data "aws_iam_policy_document" "api_task" {
  # Object-level access to the three app buckets.
  statement {
    sid     = "AppBucketObjects"
    actions = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = [
      "${module.s3_audit.bucket_arn}/*",
      "${module.s3_assets.bucket_arn}/*",
      "${module.s3_exports.bucket_arn}/*",
    ]
  }
  statement {
    sid     = "AppBucketList"
    actions = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = [
      module.s3_audit.bucket_arn,
      module.s3_assets.bucket_arn,
      module.s3_exports.bucket_arn,
    ]
  }
  # KMS for S3 object encryption + the PII envelope key (AWS_KMS_KEY_ARN).
  statement {
    sid = "AppKms"
    actions = [
      "kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*",
      "kms:GenerateDataKey*", "kms:DescribeKey",
    ]
    resources = [
      module.kms_s3_audit.key_arn,
      module.kms_rds.key_arn,
    ]
  }
  # ECS Exec (debug shell) channel.
  statement {
    sid = "EcsExec"
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "api_task" {
  name   = "${local.name}-api-task"
  role   = aws_iam_role.api_task.id
  policy = data.aws_iam_policy_document.api_task.json
}

# ── ALB ──────────────────────────────────────────────────────────────────────
module "alb" {
  source             = "../../../modules/alb"
  name               = "${local.name}-api"
  vpc_id             = module.network.vpc_id
  public_subnet_ids  = module.network.public_subnet_ids
  security_group_ids = [aws_security_group.alb.id]
  container_port     = var.api_container_port
  health_check_path  = "/v1/healthz"
  certificate_arn    = var.acm_certificate_arn
  tags               = local.tags
}

# ── ECS service (apps/api) ───────────────────────────────────────────────────
module "api_service" {
  source = "../../../modules/ecs-service"

  name              = "${local.name}-api"
  cluster_id        = aws_ecs_cluster.this.arn
  cluster_name      = aws_ecs_cluster.this.name
  image             = local.api_image
  container_port    = var.api_container_port
  health_check_path = "/v1/healthz"
  task_cpu          = var.api_task_cpu
  task_memory       = var.api_task_memory
  desired_count     = var.api_desired_count

  subnet_ids         = module.network.private_subnet_ids
  security_group_ids = [aws_security_group.app.id]
  target_group_arn   = module.alb.target_group_arn

  task_role_arn      = aws_iam_role.api_task.arn
  execution_role_arn = aws_iam_role.api_execution.arn
  log_kms_key_arn    = module.kms_redis_secrets.key_arn

  # Non-secret config. Secrets (incl. DATABASE_URL/REDIS_URL) via secret_arns.
  env_vars = [
    { name = "NODE_ENV", value = "production" },
    { name = "AWS_REGION", value = var.region },
    { name = "PORT", value = tostring(var.api_container_port) },
    { name = "HOST", value = "0.0.0.0" },
    { name = "LOG_LEVEL", value = "info" },
    { name = "CORS_ORIGINS", value = var.cors_origins },
    { name = "S3_BUCKET_AUDIT", value = module.s3_audit.bucket_name },
    { name = "S3_BUCKET_ASSETS", value = module.s3_assets.bucket_name },
    { name = "S3_BUCKET_EXPORTS", value = module.s3_exports.bucket_name },
    # HARDENING-LOG P0-perf: scrypt uses libuv threads for password hashing.
    # Default UV_THREADPOOL_SIZE=4 starves under concurrent login load (50k target).
    # 16 threads gives headroom for scrypt + any other async-thread-pool work
    # (crypto, dns, fs) without exhausting Fargate task CPU budget.
    { name = "UV_THREADPOOL_SIZE", value = "16" },
  ]

  secret_arns = local.api_secret_arns

  # Migration one-off task runs prisma migrate deploy (after PostGIS bootstrap).
  migrate_command = ["pnpm", "--filter", "api", "db:migrate"]

  tags = local.tags

  # Ensure the ALB + listener + target group exist before the service tries to
  # register with the target group (static module reference = real ordering).
  depends_on = [module.alb]
}
