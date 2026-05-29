/**
 * Encrypted private S3 bucket.
 *
 * Forked from EazePay's `s3-bucket` module, extended to support Object Lock
 * COMPLIANCE mode (EazePay only exposed GOVERNANCE). Default-deny public
 * access, KMS SSE always on, versioning always on. Optional Object Lock for
 * write-once retention (the audit-archive bucket uses COMPLIANCE so even the
 * root account cannot delete locked objects before retention elapses).
 *
 * NOTE: object_lock_enabled is immutable after bucket creation and requires
 * versioning. Buckets that may receive VPC flow logs also get a bucket policy
 * permitting the delivery.logs.amazonaws.com service principal to write.
 */

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "this" {
  bucket              = var.name
  object_lock_enabled = var.object_lock_enabled
  force_destroy       = false
  tags                = var.tags
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enforce TLS-only access on every bucket.
data "aws_iam_policy_document" "bucket" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.this.arn,
      "${aws_s3_bucket.this.arn}/*",
    ]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  # Allow VPC flow log delivery to write into the bucket when requested.
  dynamic "statement" {
    for_each = var.allow_flow_logs ? [1] : []
    content {
      sid     = "AllowFlowLogDelivery"
      effect  = "Allow"
      actions = ["s3:PutObject"]
      resources = [
        "${aws_s3_bucket.this.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*",
      ]
      principals {
        type        = "Service"
        identifiers = ["delivery.logs.amazonaws.com"]
      }
      condition {
        test     = "StringEquals"
        variable = "s3:x-amz-acl"
        values   = ["bucket-owner-full-control"]
      }
    }
  }

  dynamic "statement" {
    for_each = var.allow_flow_logs ? [1] : []
    content {
      sid       = "AllowFlowLogAclCheck"
      effect    = "Allow"
      actions   = ["s3:GetBucketAcl"]
      resources = [aws_s3_bucket.this.arn]
      principals {
        type        = "Service"
        identifiers = ["delivery.logs.amazonaws.com"]
      }
    }
  }
}

resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.id
  policy = data.aws_iam_policy_document.bucket.json
}

resource "aws_s3_bucket_object_lock_configuration" "this" {
  count  = var.object_lock_enabled && var.object_lock_default_retention_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.this.id
  rule {
    default_retention {
      mode = var.object_lock_mode
      days = var.object_lock_default_retention_days
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  count  = var.lifecycle_expire_after_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.this.id
  rule {
    id     = "auto-expire"
    status = "Enabled"
    filter {}
    expiration {
      days = var.lifecycle_expire_after_days
    }
    noncurrent_version_expiration {
      noncurrent_days = max(30, var.lifecycle_expire_after_days)
    }
  }
}
