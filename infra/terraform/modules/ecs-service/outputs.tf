output "service_name" {
  value       = aws_ecs_service.this.name
  description = "ECS service name."
}

output "task_definition_arn" {
  value       = aws_ecs_task_definition.this.arn
  description = "Service task definition ARN."
}

output "migrate_task_definition_arn" {
  value       = aws_ecs_task_definition.migrate.arn
  description = "One-off migration task definition ARN (use with aws ecs run-task)."
}

output "migrate_task_family" {
  value       = aws_ecs_task_definition.migrate.family
  description = "Migration task family name."
}

output "log_group_name" {
  value       = aws_cloudwatch_log_group.this.name
  description = "CloudWatch log group."
}
