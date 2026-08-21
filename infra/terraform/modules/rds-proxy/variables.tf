variable "name" {
  type        = string
  description = "Name prefix (e.g. d2d-prod)."
}

variable "db_cluster_id" {
  type        = string
  description = "Aurora cluster identifier to proxy to."
}

variable "db_secret_arn" {
  type        = string
  description = "Secrets Manager ARN holding the DB master {username,password} JSON. The proxy role is the only consumer; the app authenticates via IAM db auth token."
}

variable "kms_key_arn" {
  type        = string
  description = "CMK ARN used to decrypt the DB secret. The proxy IAM role gets kms:Decrypt on this key."
}

variable "subnet_ids" {
  type        = list(string)
  description = "Isolated subnet ids — same tier as Aurora."
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security group(s) attached to the proxy (ingress 5432 from app SG; egress 5432 to aurora SG)."
}

variable "idle_client_timeout" {
  type        = number
  description = "Seconds a client connection can stay idle before the proxy closes it."
  default     = 1800
}

variable "connection_borrow_timeout" {
  type        = number
  description = "Seconds a connection request can wait for a connection from the pool."
  default     = 120
}

variable "max_connections_percent" {
  type        = number
  description = "Maximum percentage of max_connections on the target DB that the proxy may open. 100 = proxy owns the whole pool."
  default     = 100
}

variable "max_idle_connections_percent" {
  type        = number
  description = "Controls how aggressively idle proxy-to-DB connections are released."
  default     = 50
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to all proxy resources."
  default     = {}
}
