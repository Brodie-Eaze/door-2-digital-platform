/**
 * ECS Fargate service for one logical app (D2D apps/api) behind an ALB.
 *
 * Forked from EazePay's `ecs-service` module, extended with:
 *   - ALB target group wiring (load_balancer block + listener dependency).
 *   - Container-level health check (CMD-SHELL against the liveness route).
 *   - A SEPARATE one-off migration task definition (no service) that runs
 *     `prisma migrate deploy`; invoked via `aws ecs run-task` before the
 *     service serves traffic (see README runbook).
 *   - Target-tracking autoscaling on CPU.
 *
 * Retained EazePay hardening: readonlyRootFilesystem, initProcessEnabled
 * (PID 1 reaping via tini in the image), deployment circuit breaker with
 * auto-rollback, non-root (USER node in Dockerfile), private subnets, no
 * public IP, KMS-encrypted CloudWatch logs.
 */

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

data "aws_region" "current" {}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/d2d/${var.name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.log_kms_key_arn
  tags              = var.tags
}

# ── Service task definition ──────────────────────────────────────────────
resource "aws_ecs_task_definition" "this" {
  family                   = var.name
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  container_definitions = jsonencode([
    {
      name         = var.name
      image        = var.image
      essential    = true
      portMappings = [{ containerPort = var.container_port, protocol = "tcp" }]
      environment  = var.env_vars
      secrets      = var.secret_arns
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.this.name
          awslogs-region        = data.aws_region.current.region
          awslogs-stream-prefix = var.name
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:${var.container_port}${var.health_check_path}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
      readonlyRootFilesystem = true
      linuxParameters = {
        initProcessEnabled = true
      }
    }
  ])

  tags = var.tags
}

# ── One-off migration task definition (run via aws ecs run-task) ─────────────
# Same image, same secrets (needs DATABASE_URL); overrides the command to run
# Prisma migrate deploy. Not attached to any service. Writable root FS so the
# Prisma engine can use /tmp.
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${var.name}-migrate"
  cpu                      = var.migrate_task_cpu
  memory                   = var.migrate_task_memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  container_definitions = jsonencode([
    {
      name        = "${var.name}-migrate"
      image       = var.image
      essential   = true
      command     = var.migrate_command
      environment = var.env_vars
      secrets     = var.secret_arns
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.this.name
          awslogs-region        = data.aws_region.current.region
          awslogs-stream-prefix = "${var.name}-migrate"
        }
      }
      readonlyRootFilesystem = false
    }
  ])

  tags = var.tags
}

# ── Service ─────────────────────────────────────────────────────────────────
resource "aws_ecs_service" "this" {
  name            = var.name
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  health_check_grace_period_seconds = 60

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = var.name
    container_port   = var.container_port
  }

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = false
  }

  enable_execute_command = true
  propagate_tags         = "TASK_DEFINITION"
  tags                   = var.tags

  # Avoid fighting CI-driven task-def image bumps; deploys update the task def.
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }
}

# ── Autoscaling (target tracking on CPU) ─────────────────────────────────────
resource "aws_appautoscaling_target" "this" {
  max_capacity       = var.max_count
  min_capacity       = var.min_count
  resource_id        = "service/${var.cluster_name}/${aws_ecs_service.this.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${var.name}-cpu-tt"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.this.resource_id
  scalable_dimension = aws_appautoscaling_target.this.scalable_dimension
  service_namespace  = aws_appautoscaling_target.this.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = var.cpu_target_value
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
