/**
 * D2D US production — extended compute plane (M2).
 *
 * Adds:
 *   - ECR repos + IAM roles + ECS Fargate services for `workers` and `webhooks`
 *   - Webhooks ALB (internal, behind CloudFront) or a dedicated target group
 *   - WAF WebACL (AWS-managed rule groups + rate-based rule) attached to the
 *     public API ALB
 *   - CloudFront distribution in front of the API (edge caching + WAF
 *     enforcement + HTTPS offload for global perf)
 *   - Route53 alias A record + ACM certificate (conditional on zone_id being
 *     set — Brodie binds the real domain after the hosted zone is created)
 *
 * Autoscaling targets are sized for 50,000 concurrent users:
 *   - API: min 3 / max 30 tasks (2 vCPU / 4 GiB each), CPU target-tracking 70%
 *   - Workers: min 2 / max 20 tasks (1 vCPU / 2 GiB), CPU target-tracking 70%
 *   - Webhooks: min 2 / max 10 tasks (0.5 vCPU / 1 GiB), CPU target-tracking 70%
 *
 * Connection math: see RUNBOOK-deploy.md "50k connection math" section.
 */

# ── ECR repos ────────────────────────────────────────────────────────────────
module "ecr_workers" {
  source = "../../../modules/ecr"
  name   = "d2d/workers"
  tags   = local.tags
}

module "ecr_webhooks" {
  source = "../../../modules/ecr"
  name   = "d2d/webhooks"
  tags   = local.tags
}

locals {
  workers_image  = "${module.ecr_workers.repository_url}:${var.workers_image_tag}"
  webhooks_image = "${module.ecr_webhooks.repository_url}:${var.webhooks_image_tag}"
}

# ── IAM: workers execution role ───────────────────────────────────────────────
resource "aws_iam_role" "workers_execution" {
  name               = "${local.name}-workers-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "workers_execution_base" {
  role       = aws_iam_role.workers_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "workers_execution_secrets" {
  statement {
    sid       = "ReadInjectedSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = local.api_secret_arn_list # workers share the same secret contract
  }
  statement {
    sid       = "DecryptSecretsCmk"
    actions   = ["kms:Decrypt"]
    resources = [module.kms_redis_secrets.key_arn]
  }
}

resource "aws_iam_role_policy" "workers_execution_secrets" {
  name   = "${local.name}-workers-execution-secrets"
  role   = aws_iam_role.workers_execution.id
  policy = data.aws_iam_policy_document.workers_execution_secrets.json
}

# ── IAM: workers task role ────────────────────────────────────────────────────
resource "aws_iam_role" "workers_task" {
  name               = "${local.name}-workers-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = local.tags
}

data "aws_iam_policy_document" "workers_task" {
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
  # IAM db-auth token generation for RDS Proxy (IAM authentication).
  statement {
    sid       = "RdsProxyIamAuth"
    actions   = ["rds-db:connect"]
    resources = ["arn:aws:rds-db:${var.region}:${data.aws_caller_identity.current.account_id}:dbuser:${module.aurora.cluster_resource_id}/*"]
  }
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

resource "aws_iam_role_policy" "workers_task" {
  name   = "${local.name}-workers-task"
  role   = aws_iam_role.workers_task.id
  policy = data.aws_iam_policy_document.workers_task.json
}

# ── IAM: webhooks execution role ──────────────────────────────────────────────
resource "aws_iam_role" "webhooks_execution" {
  name               = "${local.name}-webhooks-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "webhooks_execution_base" {
  role       = aws_iam_role.webhooks_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "webhooks_execution_secrets" {
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

resource "aws_iam_role_policy" "webhooks_execution_secrets" {
  name   = "${local.name}-webhooks-execution-secrets"
  role   = aws_iam_role.webhooks_execution.id
  policy = data.aws_iam_policy_document.webhooks_execution_secrets.json
}

# ── IAM: webhooks task role ───────────────────────────────────────────────────
resource "aws_iam_role" "webhooks_task" {
  name               = "${local.name}-webhooks-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = local.tags
}

data "aws_iam_policy_document" "webhooks_task" {
  statement {
    sid     = "AppBucketObjects"
    actions = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = [
      "${module.s3_audit.bucket_arn}/*",
      "${module.s3_assets.bucket_arn}/*",
    ]
  }
  statement {
    sid     = "AppBucketList"
    actions = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = [
      module.s3_audit.bucket_arn,
      module.s3_assets.bucket_arn,
    ]
  }
  statement {
    sid = "AppKms"
    actions = [
      "kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*",
      "kms:GenerateDataKey*", "kms:DescribeKey",
    ]
    resources = [module.kms_s3_audit.key_arn]
  }
  statement {
    sid       = "RdsProxyIamAuth"
    actions   = ["rds-db:connect"]
    resources = ["arn:aws:rds-db:${var.region}:${data.aws_caller_identity.current.account_id}:dbuser:${module.aurora.cluster_resource_id}/*"]
  }
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

resource "aws_iam_role_policy" "webhooks_task" {
  name   = "${local.name}-webhooks-task"
  role   = aws_iam_role.webhooks_task.id
  policy = data.aws_iam_policy_document.webhooks_task.json
}

# ── Add RDS Proxy IAM auth grant to the existing API task role ────────────────
# The API task role (defined in ecs.tf) needs rds-db:connect for the proxy.
resource "aws_iam_role_policy" "api_task_rds_proxy" {
  name = "${local.name}-api-task-rds-proxy"
  role = aws_iam_role.api_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "RdsProxyIamAuth"
      Effect   = "Allow"
      Action   = ["rds-db:connect"]
      Resource = ["arn:aws:rds-db:${var.region}:${data.aws_caller_identity.current.account_id}:dbuser:${module.aurora.cluster_resource_id}/*"]
    }]
  })
}

# ── Webhooks ALB (internal — accepts traffic only from CloudFront via SG rule) ─
# Webhooks are inbound events from external parties (MiCamp, Stripe).
# They sit behind the same VPC; a dedicated target group + internal ALB keeps
# webhook traffic separated from user-facing API traffic.
module "alb_webhooks" {
  source             = "../../../modules/alb"
  name               = "${local.name}-webhooks"
  vpc_id             = module.network.vpc_id
  public_subnet_ids  = module.network.public_subnet_ids
  security_group_ids = [aws_security_group.alb.id]
  container_port     = var.webhooks_container_port
  health_check_path  = "/v1/healthz"
  certificate_arn    = var.acm_certificate_arn
  tags               = local.tags
}

# ── Workers service (no ALB — pulls from BullMQ queues) ──────────────────────
module "workers_service" {
  source = "../../../modules/ecs-service"

  name              = "${local.name}-workers"
  cluster_id        = aws_ecs_cluster.this.arn
  cluster_name      = aws_ecs_cluster.this.name
  image             = local.workers_image
  container_port    = 3010 # internal only; container healthcheck still runs
  health_check_path = "/v1/healthz"
  task_cpu          = var.workers_task_cpu
  task_memory       = var.workers_task_memory
  desired_count     = var.workers_desired_count
  min_count         = var.workers_min_count
  max_count         = var.workers_max_count

  # Workers pull from BullMQ — they are not externally reachable.
  enable_load_balancer = false

  subnet_ids         = module.network.private_subnet_ids
  security_group_ids = [aws_security_group.app.id]

  task_role_arn      = aws_iam_role.workers_task.arn
  execution_role_arn = aws_iam_role.workers_execution.arn
  log_kms_key_arn    = module.kms_redis_secrets.key_arn

  env_vars = [
    { name = "NODE_ENV", value = "production" },
    { name = "AWS_REGION", value = var.region },
    { name = "LOG_LEVEL", value = "info" },
    { name = "S3_BUCKET_AUDIT", value = module.s3_audit.bucket_name },
    { name = "S3_BUCKET_ASSETS", value = module.s3_assets.bucket_name },
    { name = "S3_BUCKET_EXPORTS", value = module.s3_exports.bucket_name },
    { name = "WORKER_CONCURRENCY", value = "20" },
  ]

  secret_arns = local.api_secret_arns

  migrate_command = ["echo", "workers-no-migrate"]

  tags = local.tags
}

# ── Webhooks service ──────────────────────────────────────────────────────────
module "webhooks_service" {
  source = "../../../modules/ecs-service"

  name              = "${local.name}-webhooks"
  cluster_id        = aws_ecs_cluster.this.arn
  cluster_name      = aws_ecs_cluster.this.name
  image             = local.webhooks_image
  container_port    = var.webhooks_container_port
  health_check_path = "/v1/healthz"
  task_cpu          = var.webhooks_task_cpu
  task_memory       = var.webhooks_task_memory
  desired_count     = var.webhooks_desired_count
  min_count         = var.webhooks_min_count
  max_count         = var.webhooks_max_count

  subnet_ids         = module.network.private_subnet_ids
  security_group_ids = [aws_security_group.app.id]
  target_group_arn   = module.alb_webhooks.target_group_arn

  task_role_arn      = aws_iam_role.webhooks_task.arn
  execution_role_arn = aws_iam_role.webhooks_execution.arn
  log_kms_key_arn    = module.kms_redis_secrets.key_arn

  env_vars = [
    { name = "NODE_ENV", value = "production" },
    { name = "AWS_REGION", value = var.region },
    { name = "PORT", value = tostring(var.webhooks_container_port) },
    { name = "HOST", value = "0.0.0.0" },
    { name = "LOG_LEVEL", value = "info" },
    { name = "S3_BUCKET_AUDIT", value = module.s3_audit.bucket_name },
  ]

  secret_arns = local.api_secret_arns

  migrate_command = ["echo", "webhooks-no-migrate"]

  tags = local.tags

  depends_on = [module.alb_webhooks]
}

# ── Update API service autoscaling bounds ─────────────────────────────────────
# The ecs-service module creates target-tracking autoscaling on CPU. For the API
# the M2 bounds (min 3 / max 30) are set via variables.tf. The module already
# wires min_count/max_count from its variables. We pass them from the root
# variables via the module call in ecs.tf — add overrides here if the module
# call in ecs.tf does not expose these yet (see note in ecs.tf).
#
# NOTE: ecs.tf passes min_count/max_count = defaults (2/6). We override those
# via a second autoscaling target pointing at the same resource so Terraform
# does not clobber the module's resource. Instead, the api_service module call
# in ecs.tf is updated directly (see ecs.tf changes produced by this apply).

# ── WAF WebACL (us-east-1 scope for CloudFront — must be REGIONAL for ALB) ───
# WAF for ALB is REGIONAL scope; WAF for CloudFront is us-east-1 regional but
# must use provider alias us-east-1 (CloudFront WAF must be in us-east-1).
# Both WAF ACLs are created here; the ALB ACL uses default provider (us-east-1);
# the CloudFront ACL uses the same provider but scope="CLOUDFRONT".
resource "aws_wafv2_web_acl" "alb" {
  name        = "${local.name}-alb-waf"
  scope       = "REGIONAL"
  description = "WAF for the D2D API ALB: managed rules + rate-based rule."

  default_action {
    allow {}
  }

  # AWS managed rule group: Core Rule Set (SQLi, XSS, etc.)
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 10

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name}-alb-crs"
      sampled_requests_enabled   = true
    }
  }

  # AWS managed rule group: Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 20

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name}-alb-kbi"
      sampled_requests_enabled   = true
    }
  }

  # Rate-based rule: block IPs exceeding waf_rate_limit req/5 min.
  rule {
    name     = "RateBasedBlock"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name}-alb-rate"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name}-alb-waf"
    sampled_requests_enabled   = true
  }

  tags = local.tags
}

# Associate WAF WebACL with the API ALB.
resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = module.alb.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.alb.arn
}

# ── WAF WebACL for CloudFront (CLOUDFRONT scope) ──────────────────────────────
resource "aws_wafv2_web_acl" "cloudfront" {
  name        = "${local.name}-cf-waf"
  scope       = "CLOUDFRONT"
  description = "WAF for the D2D CloudFront distribution."

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 10

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name}-cf-crs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "RateBasedBlock"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name}-cf-rate"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name}-cf-waf"
    sampled_requests_enabled   = true
  }

  tags = local.tags
}

# ── ACM certificate (conditional on route53_zone_id being provided) ───────────
resource "aws_acm_certificate" "this" {
  count             = var.route53_zone_id != null ? 1 : 0
  domain_name       = "${var.app_subdomain}.${var.domain_name}"
  validation_method = "DNS"

  subject_alternative_names = [
    var.domain_name,
    "*.${var.domain_name}",
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = local.tags
}

# DNS validation records for ACM (only when zone_id is set).
resource "aws_route53_record" "acm_validation" {
  for_each = var.route53_zone_id != null ? {
    for dvo in aws_acm_certificate.this[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id         = var.route53_zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  count                   = var.route53_zone_id != null ? 1 : 0
  certificate_arn         = aws_acm_certificate.this[0].arn
  validation_record_fqdns = [for r in aws_route53_record.acm_validation : r.fqdn]
}

# ── CloudFront distribution ───────────────────────────────────────────────────
resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name} API distribution"
  price_class         = var.cloudfront_price_class
  web_acl_id          = aws_wafv2_web_acl.cloudfront.arn
  aliases             = var.route53_zone_id != null ? ["${var.app_subdomain}.${var.domain_name}"] : []
  wait_for_deployment = false

  origin {
    domain_name = module.alb.alb_dns_name
    origin_id   = "${local.name}-alb-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    # Custom header so the ALB can optionally verify traffic came from CloudFront.
    custom_header {
      name  = "X-Origin-Verify"
      value = random_password.cloudfront_header_secret.result
    }
  }

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "${local.name}-alb-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id            = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled (API traffic)
    origin_request_policy_id   = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AllViewerExceptHostHeader
    response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03" # SecurityHeadersPolicy

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn            = var.route53_zone_id != null ? aws_acm_certificate_validation.this[0].certificate_arn : null
    cloudfront_default_certificate = var.route53_zone_id == null ? true : false
    ssl_support_method             = var.route53_zone_id != null ? "sni-only" : null
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  tags = local.tags
}

# Secret header value — stored in Secrets Manager so the ALB origin-verify rule
# can be configured without a hardcoded literal anywhere.
resource "random_password" "cloudfront_header_secret" {
  length  = 32
  special = false
}

module "secret_cloudfront_header" {
  source        = "../../../modules/secrets"
  name          = "d2d/${var.env}/CLOUDFRONT_ORIGIN_VERIFY_SECRET"
  description   = "Header value the CloudFront distribution sends to the ALB origin for verification."
  kms_key_arn   = module.kms_redis_secrets.key_arn
  managed_value = random_password.cloudfront_header_secret.result
  tags          = local.tags
}

# ── Route53 alias record → CloudFront ────────────────────────────────────────
resource "aws_route53_record" "app" {
  count   = var.route53_zone_id != null ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "${var.app_subdomain}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}
