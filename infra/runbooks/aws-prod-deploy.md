# AWS US-East-1 Production — First Deploy Runbook

**Owner:** Brodie  
**Scope:** `infra/terraform/envs/prod/us-east-1`  
**ECS cluster:** `d2d-prod` · **Region:** `us-east-1`  
**Estimated wall-clock:** 45–90 min (Aurora + Redis provision dominate)

> This runbook is for the **first-ever** deploy. For subsequent deploys (image
> update only) jump to [Step 7](#step-7--deploy-a-new-api-image).

---

## Prerequisites

| Tool       | Minimum version | Install                  |
| ---------- | --------------- | ------------------------ |
| Terraform  | 1.6.0           | `brew install terraform` |
| AWS CLI v2 | 2.15            | `brew install awscli`    |
| Docker     | 24              | Docker Desktop           |
| pnpm       | 9               | `npm i -g pnpm`          |

**AWS credentials:** authenticate as an IAM Identity Center role that has
`AdministratorAccess` in the `d2d-prod` account. Export the short-lived
credentials into the current shell session before proceeding.

```bash
aws sso login --profile d2d-prod
export AWS_PROFILE=d2d-prod
aws sts get-caller-identity   # must succeed
```

---

## Step 0 — Bootstrap remote state (one-time, before `terraform init`)

Terraform itself cannot create the S3 bucket and DynamoDB table it needs to
store its own state — the chicken/egg problem. Do this once, manually:

```bash
# S3 state bucket — versioning ON, encryption ON
aws s3api create-bucket \
  --bucket d2d-prod-tfstate-us-east-1 \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket d2d-prod-tfstate-us-east-1 \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket d2d-prod-tfstate-us-east-1 \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'

aws s3api put-public-access-block \
  --bucket d2d-prod-tfstate-us-east-1 \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# DynamoDB lock table — must be exactly this name
aws dynamodb create-table \
  --table-name d2d-prod-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

Verify both exist before continuing:

```bash
aws s3api head-bucket --bucket d2d-prod-tfstate-us-east-1
aws dynamodb describe-table --table-name d2d-prod-tflock --query "Table.TableStatus"
```

---

## Step 1 — Populate tfvars

```bash
cd infra/terraform/envs/prod/us-east-1
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` — the only non-default values you need to fill in for
the first apply:

```hcl
# Get this ARN from IAM Identity Center console:
#   IAM → Roles → search "AWSReservedSSO_AdministratorAccess"
kms_key_admin_arns = ["arn:aws:iam::<ACCOUNT_ID>:role/AWSReservedSSO_AdministratorAccess_<hash>"]

# Leave these commented for the first HTTP-only bring-up:
# acm_certificate_arn = "..."   # add in Step 9
```

`terraform.tfvars` is git-ignored — never commit it.

---

## Step 2 — Init and validate

```bash
terraform init
terraform validate
```

Expected: `Success! The configuration is valid.`

If you see "Backend configuration changed" follow the prompted migration.

---

## Step 3 — Plan

```bash
terraform plan -out=tfplan 2>&1 | tee /tmp/d2d-prod-plan.txt | tail -20
```

Skim the output for surprises. Expected creates on first apply:

- VPC + 3 private + 3 public subnets + NAT gateways
- Aurora Serverless v2 cluster (2 instances)
- ElastiCache Redis (cache.t4g.small × 2 with 1 replica)
- 3 KMS CMKs (rds, redis-secrets, s3-audit)
- 3 S3 buckets (audit-Object-Lock, assets, exports)
- ECR repository `d2d/api`
- ECS cluster + IAM roles
- ALB (HTTP listener only — HTTPS added in Step 9)
- 42 Secrets Manager slots (13 required + 29 optional, all empty)

---

## Step 4 — Apply

```bash
terraform apply tfplan
```

This takes **30–60 minutes** — Aurora and Redis provision is the long pole.
When it completes, capture outputs:

```bash
terraform output -json > /tmp/d2d-prod-outputs.json
cat /tmp/d2d-prod-outputs.json
```

Note these values (you'll need them shortly):

```bash
ECR_URL=$(terraform output -raw ecr_api_repository_url)
ALB_DNS=$(terraform output -raw alb_dns_name)
CLUSTER=$(terraform output -raw ecs_cluster_name)
SERVICE=$(terraform output -raw ecs_service_name)
MIGRATE_FAMILY=$(terraform output -raw migrate_task_family)
PRIVATE_SUBNETS=$(terraform output -json private_subnet_ids | jq -r 'join(",")')
APP_SG=$(terraform output -raw app_security_group_id)
```

---

## Step 5 — Inject required secrets

The 13 required secrets must be injected before the ECS service scales up.
The app calls `aws secretsmanager get-secret-value` at boot and fails fast if
any are missing or empty.

**Generate strong values:**

```bash
# 32-byte hex keys
openssl rand -hex 32   # → PII_ENCRYPTION_KEY, PII_HASH_SECRET, PII_SEARCH_KEY,
                        #   AUDIT_CHAIN_SECRET, JWT_ACCESS_SECRET,
                        #   JWT_REFRESH_SECRET, JWT_WS_TICKET_SECRET,
                        #   CSRF_SIGNING_SECRET, OAUTH_STATE_SECRET,
                        #   MFA_STEP_UP_SECRET, API_TOKEN_HASH_SECRET

# KMS-backed wrap keys (at least 40 chars — use 64 for headroom)
openssl rand -hex 32   # → PII_KMS_KEY (use your KMS CMK ID in prod, or a 64-char hex stub for initial test)
openssl rand -hex 32   # → PII_SIV_KEY
```

**Inject each one:**

```bash
# Template — repeat for every required secret
aws secretsmanager put-secret-value \
  --secret-id "d2d/prod/PII_ENCRYPTION_KEY" \
  --secret-string "$(openssl rand -hex 32)"

# Do the same for:
#   PII_HASH_SECRET, PII_SEARCH_KEY, AUDIT_CHAIN_SECRET,
#   PII_KMS_KEY, PII_SIV_KEY,
#   JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_WS_TICKET_SECRET,
#   CSRF_SIGNING_SECRET, OAUTH_STATE_SECRET,
#   MFA_STEP_UP_SECRET, API_TOKEN_HASH_SECRET
```

Verify all 13 are populated (none should have `"SecretString": ""`):

```bash
for s in PII_ENCRYPTION_KEY PII_HASH_SECRET PII_SEARCH_KEY AUDIT_CHAIN_SECRET \
          PII_KMS_KEY PII_SIV_KEY JWT_ACCESS_SECRET JWT_REFRESH_SECRET \
          JWT_WS_TICKET_SECRET CSRF_SIGNING_SECRET OAUTH_STATE_SECRET \
          MFA_STEP_UP_SECRET API_TOKEN_HASH_SECRET; do
  val=$(aws secretsmanager get-secret-value --secret-id "d2d/prod/$s" \
        --query SecretString --output text 2>&1)
  [ ${#val} -ge 10 ] && echo "✓ $s" || echo "✗ $s — MISSING"
done
```

> **Optional secrets** (MICAMP, Stripe, Twilio, etc.) can be filled when
> those integrations go live. The app boots without them.

---

## Step 6 — Build and push the API image

From the monorepo root:

```bash
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin "$ECR_URL"

docker build \
  -f Dockerfile.api \
  -t "$ECR_URL:$(git rev-parse --short HEAD)" \
  -t "$ECR_URL:latest" \
  .

docker push "$ECR_URL:$(git rev-parse --short HEAD)"
docker push "$ECR_URL:latest"

IMAGE_TAG=$(git rev-parse --short HEAD)
echo "Image tag: $IMAGE_TAG"
```

Update `api_image_tag` in `terraform.tfvars`:

```hcl
api_image_tag = "<git-sha>"   # e.g. "74b3814"
```

Then re-apply to register the new image in the task definition:

```bash
terraform apply -auto-approve
```

---

## Step 7 — Run database migrations

Prisma migrations run as a one-off ECS task using the dedicated migrate task
family (it runs `prisma migrate deploy` then exits):

```bash
aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$MIGRATE_FAMILY" \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNETS],securityGroups=[$APP_SG],assignPublicIp=DISABLED}" \
  --launch-type FARGATE \
  --region us-east-1

# Wait for it to stop (exit 0)
aws ecs wait tasks-stopped \
  --cluster "$CLUSTER" \
  --tasks "$(aws ecs list-tasks --cluster "$CLUSTER" --family "$MIGRATE_FAMILY" --query 'taskArns[0]' --output text)"
```

Check exit code:

```bash
aws ecs describe-tasks \
  --cluster "$CLUSTER" \
  --tasks "$(aws ecs list-tasks --cluster "$CLUSTER" --family "$MIGRATE_FAMILY" --query 'taskArns[0]' --output text)" \
  --query 'tasks[0].containers[0].exitCode'
```

`0` = success. Non-zero = check CloudWatch Logs at `/ecs/d2d-prod-api-migrate`.

---

## Step 8 — Scale up and smoke test

The ECS service starts with `desired_count = 0` until migrations confirm.
Scale it up:

```bash
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --desired-count 2 \
  --region us-east-1

aws ecs wait services-stable \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --region us-east-1
```

Smoke test over HTTP (HTTPS comes next):

```bash
curl -s "http://$ALB_DNS/v1/healthz" | jq .
# Expected: { "status": "ok", "region": "us-east-1" }
```

Check task logs in CloudWatch (`/ecs/d2d-prod-api`) for any boot errors.

---

## Step 9 — Issue ACM certificate and enable HTTPS

1. Request a certificate in ACM (must be in `us-east-1` for ALB use):

```bash
aws acm request-certificate \
  --domain-name api.door2digital.com \
  --subject-alternative-names "api-us.door2digital.com" \
  --validation-method DNS \
  --region us-east-1
```

2. Add the DNS validation CNAME records to Route 53 (ACM console shows them).
   Wait for status `ISSUED` (usually 5–30 min).

3. Get the certificate ARN:

```bash
aws acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[?DomainName=='api.door2digital.com'].CertificateArn" \
  --output text
```

4. Add to `terraform.tfvars`:

```hcl
acm_certificate_arn = "arn:aws:acm:us-east-1:<acct>:certificate/<id>"
```

5. Apply to add the HTTPS 443 listener:

```bash
terraform apply -auto-approve
```

6. Point Route 53 at the ALB:

```bash
# Create a weighted alias record for api.door2digital.com → ALB DNS name
# Do this in the Route 53 console or via the aws route53 change-resource-record-sets command
```

7. Final smoke test:

```bash
curl -s "https://api.door2digital.com/v1/healthz" | jq .
```

---

## Step 10 — Seed reference data (first deploy only)

Run the seed script to create the D2D operator org and initial admin user:

```bash
aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "d2d-prod-api-seed" \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNETS],securityGroups=[$APP_SG],assignPublicIp=DISABLED}" \
  --launch-type FARGATE \
  --region us-east-1
```

> If the seed task family doesn't exist yet, run the seed locally against the
> prod `DATABASE_URL`:
>
> ```bash
> DATABASE_URL="$(aws secretsmanager get-secret-value \
>   --secret-id d2d/prod/DATABASE_URL --query SecretString --output text)" \
>   pnpm --filter api seed
> ```

---

## Subsequent deploys (image update only)

For a routine code deploy after the first bring-up:

```bash
# 1. Build + push
docker build -f Dockerfile.api -t "$ECR_URL:$IMAGE_TAG" . && docker push "$ECR_URL:$IMAGE_TAG"

# 2. Update tfvars api_image_tag and re-apply OR force a new deployment:
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --force-new-deployment \
  --region us-east-1

# 3. Run migrations if there are any new migration files
#    (check: git diff main -- apps/api/prisma/migrations)
aws ecs run-task --cluster "$CLUSTER" --task-definition "$MIGRATE_FAMILY" \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNETS],securityGroups=[$APP_SG],assignPublicIp=DISABLED}" \
  --launch-type FARGATE

# 4. Wait for service stable
aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE"

# 5. Smoke test
curl -s "https://api.door2digital.com/v1/healthz" | jq .
```

---

## Troubleshooting

| Symptom                               | First place to look                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| ECS task immediately stops            | CloudWatch Logs `/ecs/d2d-prod-api` → missing required secret or DB not reachable          |
| `terraform apply` times out on Aurora | Normal — Aurora Serverless v2 first provision can take 25 min. Do not interrupt            |
| Migrations fail (exit ≠ 0)            | CloudWatch `/ecs/d2d-prod-api-migrate` — usually an auth error (wrong DATABASE_URL secret) |
| ALB returns 502                       | ECS tasks failing health check — check `/ecs/d2d-prod-api` logs                            |
| `ECR: no basic auth credentials`      | Re-run `aws ecr get-login-password` — token is valid for 12h                               |
| `Backend configuration mismatch`      | Run `terraform init -reconfigure`                                                          |

---

## Reference: required secret values

| Secret                  | Format      | Source                                                  |
| ----------------------- | ----------- | ------------------------------------------------------- |
| `PII_ENCRYPTION_KEY`    | 64-char hex | `openssl rand -hex 32`                                  |
| `PII_HASH_SECRET`       | 64-char hex | `openssl rand -hex 32`                                  |
| `PII_SEARCH_KEY`        | 64-char hex | `openssl rand -hex 32`                                  |
| `AUDIT_CHAIN_SECRET`    | 64-char hex | `openssl rand -hex 32`                                  |
| `PII_KMS_KEY`           | ≥40 chars   | KMS CMK ID (or `openssl rand -hex 32` for initial test) |
| `PII_SIV_KEY`           | ≥40 chars   | KMS CMK ID (or `openssl rand -hex 32` for initial test) |
| `JWT_ACCESS_SECRET`     | 64-char hex | `openssl rand -hex 32`                                  |
| `JWT_REFRESH_SECRET`    | 64-char hex | `openssl rand -hex 32`                                  |
| `JWT_WS_TICKET_SECRET`  | 64-char hex | `openssl rand -hex 32`                                  |
| `CSRF_SIGNING_SECRET`   | 64-char hex | `openssl rand -hex 32`                                  |
| `OAUTH_STATE_SECRET`    | 64-char hex | `openssl rand -hex 32`                                  |
| `MFA_STEP_UP_SECRET`    | 64-char hex | `openssl rand -hex 32`                                  |
| `API_TOKEN_HASH_SECRET` | 64-char hex | `openssl rand -hex 32`                                  |

`DATABASE_URL` and `REDIS_URL` are composed automatically by Terraform from
the Aurora and Redis endpoints — they are **not** in the above list and should
not be set manually.
