variable "name" {
  type        = string
  description = "Name prefix (e.g. d2d-prod)."
}

variable "subnet_ids" {
  type        = list(string)
  description = "Isolated subnet ids for the cache subnet group."
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security groups controlling ingress (6379 from app SG only)."
}

variable "node_type" {
  type        = string
  description = "Cache node type."
  default     = "cache.t4g.small"
}

variable "engine_version" {
  type        = string
  description = "Redis engine version."
  default     = "7.1"
}

variable "parameter_group_name" {
  type        = string
  description = "ElastiCache parameter group."
  default     = "default.redis7"
}

variable "replicas" {
  type        = number
  description = "Number of read replicas (>=1 enables multi-AZ + auto-failover)."
  default     = 1
}

variable "snapshot_retention_limit" {
  type        = number
  description = "Days to retain automatic snapshots."
  default     = 7
}

variable "kms_key_arn" {
  type        = string
  description = "CMK ARN for at-rest encryption."
}

variable "auth_secret_arn" {
  type        = string
  description = "Secrets Manager ARN holding {password} JSON for the Redis AUTH token (generated, never a literal)."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to all cache resources."
  default     = {}
}
