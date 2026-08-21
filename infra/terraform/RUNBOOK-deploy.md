# D2D Platform — AWS Deploy Runbook (M2)

`us-east-1` production stack. 50,000 concurrent-user target topology.

> **Prereqs on your machine:** AWS CLI v2, Terraform >= 1.6, `jq`, `curl`.
> No AWS resources exist yet and nothing has been applied.

---

## Six actions only you (Brodie) can do

The following steps are marked **[HUMAN]** throughout this runbook. They cannot
be automated by CI or Terraform because they are either click-ops account
bootstrapping, approval gates, or manual smoke checks.

1. **[HUMAN] Create the AWS account and configure SSO** (Step 1)
2. **[HUMAN] Bootstrap the Terraform state backend** (Step 2)
3. **[HUMAN] Configure OIDC / IAM for CI** (Step 3)
4. **[HUMAN] Approve and run `terraform apply`** (Step 6)
5. **[HUMAN] Bind the domain in Route53 and attach the ACM cert** (Step 10)
6. **[HUMAN] Smoke-check the live service** (Step 11)

---

## 50k connection math

This is the justification for RDS Proxy and the ECS sizing.

| Layer                            | Value   | Notes                                                                                  |
| -------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| Aurora max ACU                   | 128     | `aurora_max_acu = 128` in tfvars                                                       |
| Aurora max_connections           | ~5,000  | Formula: `LEAST(DBInstanceClassMemory / 9531392, 5000)` at 128 ACU                     |
| ECS API tasks ceiling            | 30      | `api_max_count = 30`                                                                   |
| Prisma pool per task             | 10      | `DATABASE_URL?connection_limit=10` (set in your Prisma config)                         |
| Raw app connections (ceiling)    | 300     | 30 tasks × 10 connections each                                                         |
| ECS workers tasks ceiling        | 20      | `workers_max_count = 20`                                                               |
| Prisma pool per worker task      | 5       | Workers have lower concurrency needs                                                   |
| Raw worker connections (ceiling) | 100     | 20 tasks × 5 connections each                                                          |
| **Total raw connections**        | **400** | Well within Aurora's 5,000 limit                                                       |
| RDS Proxy pool to Aurora         | 400     | `max_connections_percent = 100`; proxy holds at most 400 connections to Aurora at peak |
| RDS Proxy multiplexing ratio     | ~10:1   | 4,000+ app-side connections (pre-proxy) mux to 400 Aurora connections                  |

**Why the proxy is essential:** Without the proxy, each Fargate task holds open
its Prisma pool connections for the lifetime of the task. During a burst
(auto-scale from 3 to 30 tasks in 2 minutes), new tasks try to open connections
simultaneously. Aurora's per-connection overhead means even 1,000 simultaneous
opens degrades latency. The proxy queues and multiplexes these, presenting a
stable connection pool to Aurora regardless of task count.

**IAM auth on the proxy:** The proxy is configured with `iam_auth = "REQUIRED"`.
App tasks authenticate using `iam:GenerateDbAuthToken` (a 15-minute signed token
built from the task's IAM role). The plaintext DB password is held only by the
proxy itself (via its IAM role reading the Secrets Manager secret). No plaintext
DB password exists in any app task definition or environment variable.

**Redis sizing for 50k:** `cache.r7g.large` (13 GiB, 2 vCPU) handles ~100k
ops/sec — sufficient for rate-limiting counters (one INCR per request) plus
BullMQ job queuing and session cache at 50k concurrent users. Two read replicas
provide multi-AZ HA and distribute read load.

---

## Step 1 — Create the AWS Org + account [HUMAN]

1. In the management (root) account: **AWS Organizations → Create organization**.
2. Create OU `Workloads`. Under it, create a dedicated member account `d2d-prod`.
   Do not run production in the management account.
3. Enable **IAM Identity Center (SSO)**. Create a permission set
   `AdministratorAccess`. Assign yourself to `d2d-prod` with that permission set.
   **Do not create long-lived IAM access keys for human users.**
4. Recommended org-wide controls:
   - Enable CloudTrail in all accounts.
   - Service Control Policy (SCP): deny root usage, restrict all non-exempt
     services to `us-east-1`.
   - AWS Config: record all resource changes.

---

## Step 2 — Bootstrap the Terraform state backend [HUMAN]

Terraform cannot store state in a bucket it hasn't created yet. Create these
once, manually, in the `d2d-prod` account. Names must match `versions.tf`.

```bash
# Confirm you are in d2d-prod:
aws sts get-caller-identity

# S3 state bucket:
aws s3api create-bucket \
  --bucket d2d-prod-tfstate-us-east-1 \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket d2d-prod-tfstate-us-east-1 \
  --versioning-configuration Status=Enabled

aws s3api put-public-access-block \
  --bucket d2d-prod-tfstate-us-east-1 \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-encryption \
  --bucket d2d-prod-tfstate-us-east-1 \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'

# DynamoDB lock table:
aws dynamodb create-table \
  --table-name d2d-prod-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

---

## Step 3 — Configure credentials for CI [HUMAN]

CI uses GitHub OIDC (no long-lived keys stored in GitHub). This is a one-time
setup per repo.

```bash
# 3a. Create a GitHub OIDC identity provider in d2d-prod:
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# 3b. Create the CI deploy role (scope to your repo):
# Replace ACCOUNT_ID and REPO_ORG/REPO_NAME.
cat > /tmp/ci-trust.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:REPO_ORG/d2d-platform:*"
      },
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      }
    }
  }]
}
EOF

aws iam create-role \
  --role-name d2d-prod-github-deploy \
  --assume-role-policy-document file:///tmp/ci-trust.json

# 3c. Attach minimum required permissions (adjust after first apply when
#     Terraform has created the ECR / ECS resources):
#   - ecr:GetAuthorizationToken
#   - ecr:BatchGetImage, ecr:InitiateLayerUpload, etc. on repo d2d/api, d2d/workers, d2d/webhooks
#   - ecs:RegisterTaskDefinition, ecs:UpdateService, ecs:DescribeServices,
#     ecs:DescribeTaskDefinition, ecs:RunTask, ecs:DescribeTasks
#   - iam:PassRole for the api/workers/webhooks task + execution roles
#   - cloudfront:CreateInvalidation on the distribution id (for cache busting)
#
# 3d. Set these repo VARIABLES in GitHub (not secrets — not sensitive):
#   AWS_DEPLOY_ROLE_ARN   = arn:aws:iam::ACCOUNT_ID:role/d2d-prod-github-deploy
#   AWS_REGION            = us-east-1
#   ECR_REPOSITORY        = d2d/api
#   ECS_CLUSTER           = (from terraform output ecs_cluster_name)
#   ECS_SERVICE           = (from terraform output ecs_service_name)
#   ECS_TASK_FAMILY       = (from terraform output ecs_service_name)
#   ECS_MIGRATE_FAMILY    = (from terraform output migrate_task_family)
#   ECS_SUBNETS           = (from terraform output private_subnet_ids, comma-joined)
#   ECS_SECURITY_GROUP    = (from terraform output app_security_group_id)
#   CLOUDFRONT_DIST_ID    = (from terraform output cloudfront_distribution_id)
```

---

## Step 4 — `terraform init` (with the real backend)

```bash
cd infra/terraform/envs/prod/us-east-1

# Activate SSO credentials:
aws sso login --profile d2d-prod
export AWS_PROFILE=d2d-prod

# Copy and review the example tfvars:
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — fill in kms_key_admin_arns with your SSO role ARN.
# Do NOT put any secret values here.

terraform init   # connects to the S3 backend from Step 2
```

---

## Step 5 — `terraform plan` (review carefully)

```bash
terraform plan -out tfplan
```

**Read the entire plan.** Expected resource counts at first apply:

- VPC: 1 VPC + 9 subnets (3 public / 3 private / 3 isolated) + 3 NAT GWs +
  6 VPC endpoints (ECR, Secrets, KMS, Logs, SSM, S3 gateway)
- KMS: 3 CMKs
- S3: 3 buckets (audit with Object Lock COMPLIANCE, assets, exports)
- Aurora: 1 cluster + 2 instances (writer + reader) + subnet group + param group
- RDS Proxy: 1 proxy + target group + target + IAM role
- ElastiCache: 1 replication group (r7g.large, 3 nodes across 3 AZs)
- Secrets Manager: ~47 secrets (2 generated credentials, 2 composed URLs,
  1 CloudFront origin-verify, ~42 application slots)
- ECR: 3 repos (d2d/api, d2d/workers, d2d/webhooks)
- ECS: 1 cluster + 3 services (api, workers, webhooks) + 6 task definitions
  (service + migrate for each)
- IAM: ~9 roles (rds-monitoring, rds-proxy, api/workers/webhooks execution +
  task roles)
- ALB: 2 load balancers (api, webhooks) + 2 target groups + 4 listeners
- WAF: 2 WebACLs (ALB regional + CloudFront)
- CloudFront: 1 distribution
- Security groups: alb, app, rds-proxy, aurora, redis + 4 SG rules

Resources with deletion protection (intentionally hard to destroy):

- Aurora cluster: `deletion_protection = true`
- Audit S3 bucket: Object Lock COMPLIANCE (~7-year retention)
- API ALB: `enable_deletion_protection = true`

Total expected resource count: ~150 resources.

---

## Step 6 — `terraform apply` [HUMAN]

```bash
terraform apply tfplan
```

On success, capture all outputs:

```bash
terraform output -json > /tmp/d2d-prod-outputs.json
cat /tmp/d2d-prod-outputs.json | jq 'keys'
```

Key values you will need in subsequent steps:

```bash
CLUSTER=$(terraform output -raw ecs_cluster_name)
API_SERVICE=$(terraform output -raw ecs_service_name)
MIGRATE_FAMILY=$(terraform output -raw migrate_task_family)
SUBNETS=$(terraform output -json private_subnet_ids | jq -r 'join(",")')
APP_SG=$(terraform output -raw app_security_group_id)
PROXY_ENDPOINT=$(terraform output -raw rds_proxy_endpoint)
CF_DIST_ID=$(terraform output -raw cloudfront_distribution_id)
CF_DOMAIN=$(terraform output -raw cloudfront_domain_name)
```

> The ECS services will start with `desired_count` tasks but the tasks will
> FAIL health checks until secrets are injected (Step 7) and migrations run
> (Step 8). This is expected. Optionally set `api_desired_count=0`,
> `workers_desired_count=0`, `webhooks_desired_count=0` for the first apply,
> then bump them up after Step 8.

---

## Step 7 — Inject real secret values (out-of-band)

These values never touch Terraform. Generate them locally and inject via CLI.

```bash
# Required secrets — the app fails fast at boot if any are missing:
aws secretsmanager put-secret-value --secret-id d2d/prod/PII_ENCRYPTION_KEY \
  --secret-string "$(openssl rand -hex 32)"          # 64 hex chars

aws secretsmanager put-secret-value --secret-id d2d/prod/PII_HASH_SECRET \
  --secret-string "$(openssl rand -base64 48)"       # >=32 chars

aws secretsmanager put-secret-value --secret-id d2d/prod/PII_SEARCH_KEY \
  --secret-string "$(openssl rand -base64 48)"

aws secretsmanager put-secret-value --secret-id d2d/prod/AUDIT_CHAIN_SECRET \
  --secret-string "$(openssl rand -base64 48)"

# PII_KMS_KEY and PII_SIV_KEY: >=40 chars of high-entropy material.
aws secretsmanager put-secret-value --secret-id d2d/prod/PII_KMS_KEY \
  --secret-string "$(openssl rand -base64 60)"

aws secretsmanager put-secret-value --secret-id d2d/prod/PII_SIV_KEY \
  --secret-string "$(openssl rand -base64 60)"

# JWT secrets:
for SECRET in JWT_ACCESS_SECRET JWT_REFRESH_SECRET JWT_WS_TICKET_SECRET \
              CSRF_SIGNING_SECRET OAUTH_STATE_SECRET MFA_STEP_UP_SECRET \
              API_TOKEN_HASH_SECRET; do
  aws secretsmanager put-secret-value \
    --secret-id "d2d/prod/$SECRET" \
    --secret-string "$(openssl rand -base64 48)"
done
```

`terraform output required_secret_arns` lists every required slot.
`DATABASE_URL`, `REDIS_URL`, `DB_MASTER`, `REDIS_AUTH`,
`CLOUDFRONT_ORIGIN_VERIFY_SECRET` are already populated by Terraform — do not
overwrite them.

---

## Step 8 — Enable PostGIS + run migrations (one-off task)

PostGIS must be enabled once before Prisma migrations run.

```bash
# 8a. Enable PostGIS. Connect to Aurora via the RDS Proxy endpoint (use a
#     bastion/Cloud9 in the same VPC, or a temporary `aws rds-data` call):
#
#     psql "postgresql://d2d_admin:<password>@$PROXY_ENDPOINT:5432/d2d?sslmode=require"
#     d2d=> CREATE EXTENSION IF NOT EXISTS postgis;
#     d2d=> \q
#
#     The DB password is in Secrets Manager: aws secretsmanager get-secret-value
#     --secret-id d2d/prod/DB_MASTER | jq -r '.SecretString | fromjson | .password'

# 8b. Run the Prisma migration one-off task:
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$MIGRATE_FAMILY" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$APP_SG],assignPublicIp=DISABLED}" \
  --query 'tasks[0].taskArn' --output text)

echo "Migration task: $TASK_ARN"
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ARN"

EXIT_CODE=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].exitCode' --output text)
echo "Migration exit code: $EXIT_CODE"
test "$EXIT_CODE" = "0" || echo "MIGRATION FAILED — check CloudWatch /d2d/d2d-prod-api stream d2d-prod-api-migrate"
```

---

## Step 9 — First image push

Until a real image is pushed, all ECS tasks use the `bootstrap` tag which does
not exist in ECR. Set `desired_count=0` in tfvars before first apply to avoid
task-start failures, then push real images and set desired counts.

```bash
# Build and push the API image:
ECR_URL=$(terraform output -raw ecr_api_repository_url)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin "$ECR_URL"
docker build -f Dockerfile.api -t "$ECR_URL:initial" .
docker push "$ECR_URL:initial"

# Update the ECS service to use the new image (CI does this on deploy):
terraform apply -var api_image_tag=initial
```

---

## Step 10 — Bind the domain in Route53 and attach the ACM cert [HUMAN]

After you have transferred or delegated your domain to Route53:

```bash
# 10a. Find your hosted zone id:
aws route53 list-hosted-zones-by-name --dns-name door2digital.com \
  --query 'HostedZones[0].Id' --output text
# Output: /hostedzone/Z0123456789ABCDEFGHIJ
# Extract just the id: ZONE_ID=Z0123456789ABCDEFGHIJ

# 10b. Uncomment + set route53_zone_id in terraform.tfvars:
#   route53_zone_id = "Z0123456789ABCDEFGHIJ"
#   domain_name     = "door2digital.com"
#   app_subdomain   = "app"

# 10c. Re-run plan + apply. Terraform will:
#   - Issue the ACM certificate (DNS validation via Route53)
#   - Create the Route53 alias A record pointing to CloudFront
#   - Attach the certificate to the CloudFront distribution

terraform plan -out tfplan && terraform apply tfplan

# 10d. Attach the ACM cert to the ALB (for direct ALB access pre-CloudFront):
ACM_ARN=$(terraform output -json | jq -r '... | select(type=="string") | select(test("certificate"))')
# Or: AWS Console -> ACM -> copy the cert ARN from us-east-1
# Then: terraform apply -var acm_certificate_arn=arn:aws:acm:...
```

---

## Step 11 — Smoke-check the live service [HUMAN]

```bash
# Via CloudFront (after domain is bound):
curl -fsS "https://app.door2digital.com/v1/healthz"
# Expected: {"status":"ok","version":"..."}

curl -fsS "https://app.door2digital.com/v1/readyz"
# Expected: {"status":"ready","checks":{"db":"ok","redis":"ok"}}

# Direct ALB (before domain is bound):
ALB=$(terraform output -raw alb_dns_name)
curl -fsS "http://$ALB/v1/healthz"

# Verify RDS Proxy is handling DB connections (check Aurora Performance Insights):
# In RDS console: select the Aurora cluster -> Performance Insights ->
# "DBConnections" metric should show connections from the proxy, not from app
# tasks directly. App tasks should show 0 direct Aurora connections.

# Verify WAF is active:
# CloudWatch -> WAF -> WebACLs -> d2d-prod-alb-waf -> sampled requests
# You should see your healthz requests counted.

# Verify autoscaling bounds:
aws application-autoscaling describe-scalable-targets \
  --service-namespace ecs \
  --query "ScalableTargets[?ResourceId=='service/$CLUSTER/$API_SERVICE']"
# min=3, max=30 expected.
```

---

## Rollback procedures

### Application rollback

The ECS deployment circuit breaker is enabled on all three services with
`rollback = true`. If a new deployment fails the health check within the
deployment window, ECS automatically rolls back to the previous task definition.

To manually roll back to a specific image tag:

```bash
# Re-deploy a known-good image tag (never rebuild — use the immutable ECR digest):
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$API_SERVICE" \
  --task-definition "$GOOD_TASK_DEF_ARN" \
  --force-new-deployment

aws ecs wait services-stable --cluster "$CLUSTER" --services "$API_SERVICE"
```

### Infrastructure rollback

```bash
# Revert the offending Terraform commit in Git, then:
git checkout <good-commit> -- infra/terraform/
terraform plan -out tfplan   # review the diff
terraform apply tfplan
```

State is versioned in S3 (versioning enabled on the state bucket). The DynamoDB
lock table prevents concurrent applies from corrupting state.

### Database rollback (PITR)

Aurora has 35-day PITR. To restore to a point in time:

```bash
aws rds restore-db-cluster-to-point-in-time \
  --db-cluster-identifier d2d-prod-aurora-restored \
  --source-db-cluster-identifier d2d-prod-aurora \
  --restore-to-time "2026-06-05T12:00:00Z" \
  --vpc-security-group-ids <aurora-sg-id> \
  --db-subnet-group-name d2d-prod-aurora
# Then add instances, test, and failover.
```

---

## Cost estimate (M2, 50k-ready, us-east-1)

| Resource                        | Config                                            | ~$/mo            |
| ------------------------------- | ------------------------------------------------- | ---------------- |
| Aurora Serverless v2            | 2 ACU min / 128 max, 2 instances                  | 200–1,800        |
| RDS Proxy                       | per vCPU-hour of DB connections                   | 25–100           |
| ElastiCache                     | cache.r7g.large × 3 nodes                         | ~370             |
| 3× NAT gateways + data          | 3 AZ HA                                           | 100+             |
| ALB × 2 (api + webhooks)        | LCU-based                                         | 40               |
| ECS Fargate                     | 3–30 api × 2vCPU/4GiB + workers + webhooks at min | 150–1,200        |
| CloudFront                      | PriceClass_100, API traffic (no cache)            | 20–80            |
| WAF                             | 2 WebACLs × $5/mo + rule groups + request pricing | 15–50            |
| S3 + KMS + Secrets (~48) + logs |                                                   | 40               |
| **Total (min/max)**             |                                                   | **~960 – 3,640** |

Cost is dominated by Aurora scaling and ECS at peak. At actual launch traffic
(pre-50k), Aurora will sit near min ACU and Fargate near min count.

**Cost levers:** Aurora ACU floor set to 2 (not 0.5) for faster cold starts
under burst; drop to 0.5 post-analysis if cold-start latency is acceptable.
Reserved instances / Savings Plans once 3-month baseline is known.

---

## Deploy order (dependencies)

1. KMS CMKs (RDS, secrets, S3-audit)
2. S3 buckets (need audit CMK; audit bucket needs KMS)
3. VPC + subnets + NAT + VPC endpoints (needs audit bucket for flow logs)
4. Security groups (needs VPC; aurora + proxy SGs separate-create-before-attach)
5. Enhanced monitoring IAM role (for Aurora)
6. `random_password` resources (DB master, Redis auth, CloudFront header)
7. Secrets Manager: DB_MASTER, REDIS_AUTH (need CMK + generated passwords)
8. Aurora cluster + instances (needs subnet group, param group, DB_MASTER secret)
9. RDS Proxy (needs Aurora cluster id, DB_MASTER secret ARN, proxy SG)
10. ElastiCache (needs subnet group, REDIS_AUTH secret)
11. DATABASE_URL secret (needs proxy endpoint + aurora port + generated password)
12. REDIS_URL secret (needs redis endpoint + generated auth token)
13. Application secret slots (x42 — needs CMK)
14. CloudFront origin-verify secret (needs CMK)
15. ECR repos × 3
16. ECS cluster
17. IAM roles × 7 (execution + task per service + rds-monitoring + rds-proxy)
18. WAF WebACLs × 2 (ALB REGIONAL + CloudFront)
19. ALB × 2 (api, webhooks)
20. ECS task definitions + services × 3 (api, workers, webhooks)
21. WAF association (needs ALB ARN + WebACL ARN)
22. CloudFront distribution (needs ALB DNS, WAF CloudFront ACL)
23. ACM certificate + validation records (conditional on route53_zone_id)
24. Route53 A record alias → CloudFront (conditional)

Terraform resolves this order automatically from the dependency graph.
The only manual sequencing required is Step 8a (PostGIS) before Step 8b
(Prisma migrations), and Step 7 (secrets injection) before bringing tasks live.
