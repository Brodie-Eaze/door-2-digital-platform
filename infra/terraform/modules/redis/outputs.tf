output "primary_endpoint" {
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
  description = "Primary endpoint host (writes)."
}

output "reader_endpoint" {
  value       = aws_elasticache_replication_group.this.reader_endpoint_address
  description = "Reader endpoint host."
}

output "port" {
  value       = aws_elasticache_replication_group.this.port
  description = "Redis port (6379)."
}
