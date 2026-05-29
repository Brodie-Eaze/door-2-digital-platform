variable "name" {
  type        = string
  description = "Human-readable key name (used in description)."
}

variable "data_class" {
  type        = string
  description = "Data class tag: rds | redis-secrets | s3-audit."
}

variable "alias" {
  type        = string
  description = "KMS alias, must start with 'alias/' (e.g. alias/d2d-prod-rds)."
}

variable "key_admins" {
  type        = list(string)
  description = "IAM ARNs allowed to administer the key."
  default     = []
}

variable "key_users" {
  type        = list(string)
  description = "IAM ARNs allowed to use the key for crypto operations."
  default     = []
}

variable "service_principals" {
  type        = list(string)
  description = "AWS service principals allowed to use the key (e.g. logs.us-east-1.amazonaws.com)."
  default     = []
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to the key."
  default     = {}
}
