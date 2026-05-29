output "vpc_id" {
  value       = aws_vpc.this.id
  description = "VPC id."
}

output "vpc_cidr_block" {
  value       = aws_vpc.this.cidr_block
  description = "VPC CIDR block."
}

output "public_subnet_ids" {
  value       = [for s in aws_subnet.public : s.id]
  description = "Public subnet ids (ALB + NAT)."
}

output "private_subnet_ids" {
  value       = [for s in aws_subnet.private : s.id]
  description = "Private subnet ids (compute)."
}

output "isolated_subnet_ids" {
  value       = [for s in aws_subnet.isolated : s.id]
  description = "Isolated subnet ids (data plane: Aurora, Redis)."
}

output "vpce_security_group_id" {
  value       = aws_security_group.vpce.id
  description = "Security group attached to the interface VPC endpoints."
}
