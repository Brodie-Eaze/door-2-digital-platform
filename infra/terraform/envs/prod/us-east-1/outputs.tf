output "vpc_id" {
  value       = module.network.vpc_id
  description = "VPC id."
}

output "private_subnet_ids" {
  value       = module.network.private_subnet_ids
  description = "Private subnet ids (use for the migration run-task)."
}

output "app_security_group_id" {
  value       = aws_security_group.app.id
  description = "App SG id (use for the migration run-task)."
}

output "ecr_api_repository_url" {
  value       = module.ecr_api.repository_url
  description = "ECR repo to push the API image to."
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.this.name
  description = "ECS cluster name (use for run-task / deploys)."
}

output "ecs_service_name" {
  value       = module.api_service.service_name
  description = "ECS API service name."
}

output "migrate_task_family" {
  value       = module.api_service.migrate_task_family
  description = "One-off migration task family for `aws ecs run-task`."
}

output "alb_dns_name" {
  value       = module.alb.alb_dns_name
  description = "ALB DNS name — smoke test /v1/healthz here, then point Route53 at it."
}

output "aurora_cluster_endpoint" {
  value       = module.aurora.cluster_endpoint
  description = "Aurora writer endpoint (host)."
}

output "redis_primary_endpoint" {
  value       = module.redis.primary_endpoint
  description = "Redis primary endpoint (host)."
}

output "s3_bucket_audit" {
  value       = module.s3_audit.bucket_name
  description = "Audit bucket (Object Lock COMPLIANCE)."
}

output "s3_bucket_assets" {
  value       = module.s3_assets.bucket_name
  description = "Assets bucket."
}

output "s3_bucket_exports" {
  value       = module.s3_exports.bucket_name
  description = "Exports bucket."
}

output "required_secret_arns" {
  value       = { for n in local.required_secret_names : n => module.app_secret[n].arn }
  description = "Map of required secret name -> ARN. Inject each via put-secret-value before scaling the service."
}

output "kms_key_arns" {
  value = {
    rds           = module.kms_rds.key_arn
    redis_secrets = module.kms_redis_secrets.key_arn
    s3_audit      = module.kms_s3_audit.key_arn
  }
  description = "CMK ARNs by data class."
}
