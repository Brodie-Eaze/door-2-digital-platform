variable "name" {
  type        = string
  description = "Repository name (e.g. d2d/api)."
}

variable "image_tag_mutability" {
  type        = string
  description = "IMMUTABLE (recommended) or MUTABLE."
  default     = "IMMUTABLE"
  validation {
    condition     = contains(["IMMUTABLE", "MUTABLE"], var.image_tag_mutability)
    error_message = "image_tag_mutability must be IMMUTABLE or MUTABLE."
  }
}

variable "keep_last_images" {
  type        = number
  description = "Number of tagged images to retain."
  default     = 20
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to the repository."
  default     = {}
}
