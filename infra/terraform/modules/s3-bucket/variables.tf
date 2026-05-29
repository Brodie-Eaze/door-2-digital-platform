variable "name" {
  type        = string
  description = "Globally-unique bucket name."
}

variable "kms_key_arn" {
  type        = string
  description = "CMK ARN for SSE-KMS."
}

variable "object_lock_enabled" {
  type        = bool
  description = "Enable Object Lock (immutable after creation; requires versioning)."
  default     = false
}

variable "object_lock_mode" {
  type        = string
  description = "GOVERNANCE (privileged users can override) or COMPLIANCE (no one can delete before retention, incl. root)."
  default     = "GOVERNANCE"
  validation {
    condition     = contains(["GOVERNANCE", "COMPLIANCE"], var.object_lock_mode)
    error_message = "object_lock_mode must be GOVERNANCE or COMPLIANCE."
  }
}

variable "object_lock_default_retention_days" {
  type        = number
  description = "Default retention period in days for locked objects (0 = no default rule)."
  default     = 0
}

variable "lifecycle_expire_after_days" {
  type        = number
  description = "Expire current objects after N days (0 = disabled). Do NOT set for COMPLIANCE-locked buckets shorter than retention."
  default     = 0
}

variable "allow_flow_logs" {
  type        = bool
  description = "Add a bucket policy statement permitting VPC flow log delivery."
  default     = false
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to the bucket."
  default     = {}
}
