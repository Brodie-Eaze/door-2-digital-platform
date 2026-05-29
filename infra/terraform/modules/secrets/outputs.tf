output "arn" {
  value       = aws_secretsmanager_secret.this.arn
  description = "ARN of the secret (use as ECS task def valueFrom)."
}

output "name" {
  value       = aws_secretsmanager_secret.this.name
  description = "Name of the secret."
}
