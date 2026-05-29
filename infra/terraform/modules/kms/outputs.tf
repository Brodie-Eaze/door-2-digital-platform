output "key_arn" {
  value       = aws_kms_key.this.arn
  description = "ARN of the CMK."
}

output "key_id" {
  value       = aws_kms_key.this.key_id
  description = "Key id of the CMK."
}

output "alias_name" {
  value       = aws_kms_alias.this.name
  description = "Alias of the CMK."
}
