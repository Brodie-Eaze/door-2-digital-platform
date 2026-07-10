variable "region" {
  type        = string
  description = "AWS region for the US data plane."
  default     = "us-east-1"
}

variable "env" {
  type        = string
  description = "Environment name."
  default     = "prod"
}

variable "owner" {
  type        = string
  description = "Cost-allocation owner tag."
  default     = "platform"
}

variable "name_prefix" {
  type        = string
  description = "Prefix for all resources."
  default     = "d2d-prod"
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR (/16)."
  default     = "10.40.0.0/16"
}

variable "azs" {
  type        = list(string)
  description = "Availability zones (3 for prod)."
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# ── Aurora ──────────────────────────────────────────────────────────────────
variable "aurora_engine_version" {
  type        = string
  description = "Aurora PostgreSQL engine version (16.x)."
  default     = "16.4"
}

variable "aurora_min_acu" {
  type        = number
  description = "Serverless v2 min ACU."
  default     = 0.5
}

variable "aurora_max_acu" {
  type        = number
  description = "Serverless v2 max ACU."
  default     = 4
}

variable "aurora_instance_count" {
  type        = number
  description = "Serverless instances (1 writer; 2 = writer+reader HA)."
  default     = 2
}

variable "db_name" {
  type        = string
  description = "Initial database name."
  default     = "d2d"
}

variable "db_master_username" {
  type        = string
  description = "Aurora master username (NOT a secret; password is generated)."
  default     = "d2d_admin"
}

# ── Redis ───────────────────────────────────────────────────────────────────
variable "redis_node_type" {
  type        = string
  description = "ElastiCache node type."
  default     = "cache.t4g.small"
}

variable "redis_replicas" {
  type        = number
  description = "Redis read replicas (>=1 => multi-AZ)."
  default     = 1
}

# ── ECS / API ───────────────────────────────────────────────────────────────
variable "api_image_tag" {
  type        = string
  description = "Image tag to deploy from the d2d/api ECR repo. CI overrides this per build."
  default     = "bootstrap"
}

variable "api_container_port" {
  type        = number
  description = "Port the API listens on (matches Dockerfile.api PORT)."
  default     = 3010
}

variable "api_desired_count" {
  type        = number
  description = "Initial API task count."
  default     = 2
}

variable "api_task_cpu" {
  type        = string
  description = "API Fargate CPU units."
  default     = "512"
}

variable "api_task_memory" {
  type        = string
  description = "API Fargate memory (MiB)."
  default     = "1024"
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM cert ARN for the ALB HTTPS listener. Null => HTTP-only bring-up; attach after issuing the cert."
  default     = null
}

variable "cors_origins" {
  type        = string
  description = "Comma-separated CORS allowlist for the API (prod web origins)."
  default     = "https://app.door2digital.com"
}

# ── KMS administration ───────────────────────────────────────────────────────
variable "kms_key_admin_arns" {
  type        = list(string)
  description = "IAM ARNs allowed to administer the CMKs (e.g. the founder's SSO admin role). Empty => root only."
  default     = []
}

# ── RDS Proxy ────────────────────────────────────────────────────────────────
variable "rds_proxy_max_connections_percent" {
  type        = number
  description = "Percentage of Aurora max_connections the proxy may open. 100 = proxy owns the full pool."
  default     = 100
}

# ── Workers service (ECS Fargate) ────────────────────────────────────────────
variable "workers_image_tag" {
  type        = string
  description = "Image tag for the workers service. CI overrides per build."
  default     = "bootstrap"
}

variable "workers_desired_count" {
  type        = number
  description = "Initial workers task count."
  default     = 2
}

variable "workers_task_cpu" {
  type        = string
  description = "Workers Fargate task CPU units."
  default     = "1024"
}

variable "workers_task_memory" {
  type        = string
  description = "Workers Fargate task memory (MiB)."
  default     = "2048"
}

variable "workers_min_count" {
  type        = number
  description = "Workers autoscaling floor."
  default     = 2
}

variable "workers_max_count" {
  type        = number
  description = "Workers autoscaling ceiling (sized for 50k-user BullMQ backlog)."
  default     = 20
}

# ── Webhooks service (ECS Fargate) ───────────────────────────────────────────
variable "webhooks_image_tag" {
  type        = string
  description = "Image tag for the webhooks service. CI overrides per build."
  default     = "bootstrap"
}

variable "webhooks_container_port" {
  type        = number
  description = "Port the webhooks service listens on."
  default     = 3011
}

variable "webhooks_desired_count" {
  type        = number
  description = "Initial webhooks task count."
  default     = 2
}

variable "webhooks_task_cpu" {
  type        = string
  description = "Webhooks Fargate task CPU units."
  default     = "512"
}

variable "webhooks_task_memory" {
  type        = string
  description = "Webhooks Fargate task memory (MiB)."
  default     = "1024"
}

variable "webhooks_min_count" {
  type        = number
  description = "Webhooks autoscaling floor."
  default     = 2
}

variable "webhooks_max_count" {
  type        = number
  description = "Webhooks autoscaling ceiling."
  default     = 10
}

# ── API autoscaling ceilings for 50k ────────────────────────────────────────
variable "api_min_count" {
  type        = number
  description = "API autoscaling floor."
  default     = 3
}

variable "api_max_count" {
  type        = number
  description = "API autoscaling ceiling sized for 50k concurrent users."
  default     = 30
}

# ── Route53 / ACM (placeholder; Brodie binds the real domain post-apply) ─────
variable "route53_zone_id" {
  type        = string
  description = "Route53 hosted zone id. Leave null to skip DNS record creation (bind after domain transfer)."
  default     = null
}

variable "domain_name" {
  type        = string
  description = "Primary domain for the ACM certificate + Route53 alias (e.g. door2digital.com)."
  default     = "door2digital.com"
}

variable "app_subdomain" {
  type        = string
  description = "App subdomain (e.g. app). The alias record created is <app_subdomain>.<domain_name>."
  default     = "app"
}

# ── CloudFront + WAF ─────────────────────────────────────────────────────────
variable "waf_rate_limit" {
  type        = number
  description = "WAF rate-based rule threshold: max requests per 5-minute window per IP before blocking."
  default     = 2000
}

variable "cloudfront_price_class" {
  type        = string
  description = "CloudFront price class. PriceClass_100 = US/EU/Canada only (cheapest for US-primary traffic)."
  default     = "PriceClass_100"
}
