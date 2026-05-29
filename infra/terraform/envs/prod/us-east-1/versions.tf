/**
 * Door 2 Digital — US production stack (us-east-1).
 * Provider + remote state backend configuration.
 *
 * Remote state lives in S3 with a DynamoDB lock table. Both MUST be
 * bootstrapped manually by the founder BEFORE `terraform init` (chicken/egg:
 * Terraform can't store its own state in a bucket it hasn't created yet).
 * See README.md "Step 2 — Bootstrap the Terraform state backend".
 *
 * For OFFLINE validation the backend is skipped:
 *   terraform init -backend=false && terraform validate
 */

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5"
    }
  }

  backend "s3" {
    bucket         = "d2d-prod-tfstate-us-east-1"
    key            = "prod/us-east-1/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "d2d-prod-tflock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "d2d"
      Env       = var.env
      Region    = var.region
      ManagedBy = "terraform"
      Owner     = var.owner
    }
  }
}
