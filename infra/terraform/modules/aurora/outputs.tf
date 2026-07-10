output "cluster_endpoint" {
  value       = aws_rds_cluster.this.endpoint
  description = "Writer endpoint (host)."
}

output "cluster_reader_endpoint" {
  value       = aws_rds_cluster.this.reader_endpoint
  description = "Reader endpoint (host)."
}

output "cluster_port" {
  value       = aws_rds_cluster.this.port
  description = "Cluster port (5432)."
}

output "cluster_id" {
  value       = aws_rds_cluster.this.id
  description = "Cluster identifier."
}

output "database_name" {
  value       = aws_rds_cluster.this.database_name
  description = "Initial database name."
}

output "cluster_resource_id" {
  value       = aws_rds_cluster.this.cluster_resource_id
  description = "Cluster resource id (db-XXXXXXXXXX) — required to scope iam:GenerateDbAuthToken policies."
}
