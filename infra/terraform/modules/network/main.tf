/**
 * VPC + 3-AZ subnet layout for Door 2 Digital.
 *
 * Forked from EazePay's `network` module. Three subnet tiers per AZ:
 *   - public   : ALB + NAT gateways only (internet-facing).
 *   - private  : compute (ECS Fargate tasks) — egress via NAT.
 *   - isolated : data services (Aurora, ElastiCache) — NO default route,
 *                egress to AWS services via VPC endpoints only.
 *
 * VPC flow logs ship to the audit S3 bucket. Interface endpoints for
 * ECR / Secrets Manager / KMS / Logs are declared so Fargate can pull
 * images and fetch secrets without traversing the public internet.
 */

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

data "aws_region" "current" {}

# ── VPC ──────────────────────────────────────────────────────────────────
resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(var.tags, { Name = var.name })
}

# ── Subnets (3 tiers × N AZs) ──────────────────────────────────────────────
resource "aws_subnet" "public" {
  for_each                = toset(var.azs)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.cidr_block, 4, index(var.azs, each.value))
  availability_zone       = each.value
  map_public_ip_on_launch = true
  tags = merge(var.tags, {
    Name = "${var.name}-public-${each.value}"
    Tier = "public"
  })
}

resource "aws_subnet" "private" {
  for_each          = toset(var.azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, 4, length(var.azs) + index(var.azs, each.value))
  availability_zone = each.value
  tags = merge(var.tags, {
    Name = "${var.name}-private-${each.value}"
    Tier = "private"
  })
}

resource "aws_subnet" "isolated" {
  for_each          = toset(var.azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, 4, 2 * length(var.azs) + index(var.azs, each.value))
  availability_zone = each.value
  tags = merge(var.tags, {
    Name = "${var.name}-isolated-${each.value}"
    Tier = "isolated"
  })
}

# ── Internet egress (public) ────────────────────────────────────────────────
resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name}-igw" })
}

resource "aws_eip" "nat" {
  for_each = toset(var.azs)
  domain   = "vpc"
  tags     = merge(var.tags, { Name = "${var.name}-nat-${each.value}" })
}

resource "aws_nat_gateway" "this" {
  for_each      = toset(var.azs)
  allocation_id = aws_eip.nat[each.value].id
  subnet_id     = aws_subnet.public[each.value].id
  tags          = merge(var.tags, { Name = "${var.name}-nat-${each.value}" })
  depends_on    = [aws_internet_gateway.this]
}

# ── Route tables ────────────────────────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = merge(var.tags, { Name = "${var.name}-rt-public" })
}

resource "aws_route_table_association" "public" {
  for_each       = aws_subnet.public
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  for_each = toset(var.azs)
  vpc_id   = aws_vpc.this.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[each.value].id
  }
  tags = merge(var.tags, { Name = "${var.name}-rt-private-${each.value}" })
}

resource "aws_route_table_association" "private" {
  for_each       = aws_subnet.private
  subnet_id      = each.value.id
  route_table_id = aws_route_table.private[each.key].id
}

# Isolated tier: no default route. Egress to AWS via VPC endpoints only.
resource "aws_route_table" "isolated" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name}-rt-isolated" })
}

resource "aws_route_table_association" "isolated" {
  for_each       = aws_subnet.isolated
  subnet_id      = each.value.id
  route_table_id = aws_route_table.isolated.id
}

# ── Gateway endpoint (S3) ────────────────────────────────────────────────────
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids = concat(
    [for rt in aws_route_table.private : rt.id],
    [aws_route_table.isolated.id],
  )
  tags = merge(var.tags, { Name = "${var.name}-vpce-s3" })
}

# ── Interface endpoints SG (private DNS for AWS APIs) ────────────────────────
# Allows Fargate tasks in private subnets to reach ECR / Secrets / KMS / Logs
# without internet egress. Ingress 443 from the VPC CIDR.
resource "aws_security_group" "vpce" {
  name        = "${var.name}-vpce"
  description = "Interface VPC endpoints (ECR, Secrets Manager, KMS, Logs)"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.cidr_block]
  }

  egress {
    description = "All egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name}-vpce" })
}

resource "aws_vpc_endpoint" "interface" {
  for_each = toset([
    "ecr.api",
    "ecr.dkr",
    "secretsmanager",
    "kms",
    "logs",
    "ssmmessages", # required for ECS Exec
  ])
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${data.aws_region.current.region}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [for s in aws_subnet.private : s.id]
  security_group_ids  = [aws_security_group.vpce.id]
  private_dns_enabled = true
  tags                = merge(var.tags, { Name = "${var.name}-vpce-${each.value}" })
}

# ── VPC flow logs → audit bucket ─────────────────────────────────────────────
resource "aws_flow_log" "this" {
  vpc_id               = aws_vpc.this.id
  log_destination_type = "s3"
  log_destination      = var.flow_log_bucket_arn
  traffic_type         = "ALL"
  tags                 = merge(var.tags, { Name = "${var.name}-flow-logs" })
}
