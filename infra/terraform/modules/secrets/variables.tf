variable "name" {
  type        = string
  description = "Secret name / path (e.g. d2d/prod/JWT_ACCESS_SECRET)."
}

variable "description" {
  type        = string
  description = "Human description of what the secret holds."
  default     = ""
}

variable "kms_key_arn" {
  type        = string
  description = "CMK ARN used to encrypt the secret at rest."
}

variable "recovery_window_in_days" {
  type        = number
  description = "Days before a deleted secret is permanently removed (7-30, or 0 to force)."
  default     = 30
}

variable "managed_value" {
  type        = string
  description = "If set, Terraform manages this secret's value (composed from in-state references ONLY, never a literal). If null, the secret is a slot the founder fills out-of-band."
  default     = null
  sensitive   = true
}

variable "seed_placeholder" {
  type        = bool
  description = "For slot-only secrets, seed a 'PENDING_INJECTION' placeholder version (drift-ignored). Lets the app's env validation surface a clear error before real values are injected."
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to the secret."
  default     = {}
}
