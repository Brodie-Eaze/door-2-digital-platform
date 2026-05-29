output "alb_arn" {
  value       = aws_lb.this.arn
  description = "ALB ARN."
}

output "alb_dns_name" {
  value       = aws_lb.this.dns_name
  description = "ALB DNS name (point your Route53 alias here)."
}

output "alb_zone_id" {
  value       = aws_lb.this.zone_id
  description = "ALB hosted zone id (for Route53 alias records)."
}

output "target_group_arn" {
  value       = aws_lb_target_group.this.arn
  description = "Target group ARN (wire to the ECS service load_balancer block)."
}
