variable "name" {
  type        = string
  description = "Name prefix for all network resources (e.g. d2d-prod)."
}

variable "cidr_block" {
  type        = string
  description = "VPC CIDR block. /16 recommended (e.g. 10.40.0.0/16)."
}

variable "azs" {
  type        = list(string)
  description = "Availability zones to span (3 recommended for prod)."
}

variable "flow_log_bucket_arn" {
  type        = string
  description = "ARN of the S3 bucket that receives VPC flow logs (audit bucket)."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to every network resource."
  default     = {}
}
