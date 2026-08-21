output "proxy_endpoint" {
  value       = aws_db_proxy.this.endpoint
  description = "RDS Proxy endpoint — use this as the DB host in DATABASE_URL (not the Aurora cluster endpoint directly)."
}

output "proxy_arn" {
  value       = aws_db_proxy.this.arn
  description = "RDS Proxy ARN."
}

output "proxy_name" {
  value       = aws_db_proxy.this.name
  description = "RDS Proxy name (for aws rds * commands)."
}

output "proxy_role_arn" {
  value       = aws_iam_role.proxy.arn
  description = "IAM role ARN the proxy uses to read the DB secret."
}
