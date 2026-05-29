output "repository_url" {
  value       = aws_ecr_repository.this.repository_url
  description = "Repository URL (use as image base, append :tag)."
}

output "repository_arn" {
  value       = aws_ecr_repository.this.arn
  description = "Repository ARN."
}

output "repository_name" {
  value       = aws_ecr_repository.this.name
  description = "Repository name."
}
