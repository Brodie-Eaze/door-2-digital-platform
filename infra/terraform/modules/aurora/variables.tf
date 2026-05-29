variable "name" {
  type        = string
  description = "Name prefix (e.g. d2d-prod)."
}

variable "engine_version" {
  type        = string
  description = "Aurora PostgreSQL engine version (16.x)."
  default     = "16.4"
}

variable "parameter_group_family" {
  type        = string
  description = "Cluster parameter group family."
  default     = "aurora-postgresql16"
}

variable "database_name" {
  type        = string
  description = "Initial database name."
  default     = "d2d"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Isolated subnet ids for the DB subnet group."
}

variable "kms_key_arn" {
  type        = string
  description = "CMK ARN for storage + performance insights encryption."
}

variable "master_secret_arn" {
  type        = string
  description = "Secrets Manager ARN holding {username,password} JSON (password generated, never a literal)."
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security groups controlling ingress to the cluster (5432 from app SG only)."
}

variable "min_acu" {
  type        = number
  description = "Serverless v2 minimum Aurora Capacity Units (0.5 increments)."
  default     = 0.5
}

variable "max_acu" {
  type        = number
  description = "Serverless v2 maximum Aurora Capacity Units."
  default     = 4
}

variable "instance_count" {
  type        = number
  description = "Number of serverless instances (1 writer; 2 for HA writer+reader)."
  default     = 2
}

variable "backup_retention_period" {
  type        = number
  description = "Automated backup / PITR retention in days."
  default     = 35
}

variable "deletion_protection" {
  type        = bool
  description = "Block accidental cluster deletion."
  default     = true
}

variable "monitoring_role_arn" {
  type        = string
  description = "IAM role ARN for Enhanced Monitoring (rds-monitoring-role)."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to all cluster resources."
  default     = {}
}
