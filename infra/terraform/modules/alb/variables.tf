variable "name" {
  type        = string
  description = "Name prefix (e.g. d2d-prod-api)."
}

variable "vpc_id" {
  type        = string
  description = "VPC id."
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnet ids for the ALB."
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security groups for the ALB (443/80 from internet)."
}

variable "container_port" {
  type        = number
  description = "Target container port."
  default     = 3010
}

variable "health_check_path" {
  type        = string
  description = "Target group health check path."
  default     = "/v1/healthz"
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN for HTTPS. If null, ALB serves HTTP only (pre-TLS bring-up)."
  default     = null
}

variable "enable_deletion_protection" {
  type        = bool
  description = "Protect the ALB from accidental deletion."
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to ALB resources."
  default     = {}
}
