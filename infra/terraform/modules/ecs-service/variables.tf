variable "name" {
  type        = string
  description = "Service / task family name (e.g. d2d-prod-api)."
}

variable "cluster_id" {
  type        = string
  description = "ECS cluster ARN."
}

variable "cluster_name" {
  type        = string
  description = "ECS cluster name (for the autoscaling resource id)."
}

variable "image" {
  type        = string
  description = "Container image reference (ECR repo url + tag)."
}

variable "container_port" {
  type        = number
  description = "Port the app listens on."
  default     = 3010
}

variable "health_check_path" {
  type        = string
  description = "Liveness path for the container health check."
  default     = "/v1/healthz"
}

variable "task_cpu" {
  type        = string
  description = "Fargate task CPU units."
  default     = "512"
}

variable "task_memory" {
  type        = string
  description = "Fargate task memory (MiB)."
  default     = "1024"
}

variable "desired_count" {
  type        = number
  description = "Initial desired task count."
  default     = 2
}

variable "min_count" {
  type        = number
  description = "Autoscaling floor."
  default     = 2
}

variable "max_count" {
  type        = number
  description = "Autoscaling ceiling."
  default     = 6
}

variable "cpu_target_value" {
  type        = number
  description = "Target average CPU % for autoscaling."
  default     = 60
}

variable "cpu_architecture" {
  type        = string
  description = "X86_64 or ARM64. Match the image build platform."
  default     = "X86_64"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnet ids for the tasks."
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security groups for the tasks (ingress from ALB SG only)."
}

variable "target_group_arn" {
  type        = string
  description = "ALB target group ARN to register tasks with. The caller must ensure the ALB listener forwarding to this target group exists before the service is created (use `depends_on = [module.alb]` on the module call)."
}

variable "task_role_arn" {
  type        = string
  description = "IAM role assumed by the app (S3, KMS, Secrets at runtime)."
}

variable "execution_role_arn" {
  type        = string
  description = "IAM role used by the ECS agent (ECR pull, secret fetch, logs)."
}

variable "log_kms_key_arn" {
  type        = string
  description = "CMK ARN for CloudWatch log group encryption."
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention."
  default     = 30
}

variable "env_vars" {
  type        = list(object({ name = string, value = string }))
  description = "Non-secret environment variables."
  default     = []
}

variable "secret_arns" {
  type        = list(object({ name = string, valueFrom = string }))
  description = "Secrets injected from Secrets Manager (name -> ARN)."
  default     = []
}

variable "migrate_command" {
  type        = list(string)
  description = "Command for the one-off migration task."
  default     = ["pnpm", "--filter", "api", "db:migrate"]
}

variable "migrate_task_cpu" {
  type        = string
  description = "CPU for the migration task."
  default     = "512"
}

variable "migrate_task_memory" {
  type        = string
  description = "Memory for the migration task (MiB)."
  default     = "1024"
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to all service resources."
  default     = {}
}
