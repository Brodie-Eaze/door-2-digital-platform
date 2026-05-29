# Door 2 Digital — AWS Infrastructure-as-Code

Terraform for the D2D **US production** data + compute plane (`us-east-1`).
Forked from EazePay's battle-tested modules, adapted for D2D.

> **Status:** offline-validated. `terraform validate` passes clean (zero
> warnings). NOTHING has been applied — there are no AWS credentials in this
> repo and no AWS account exists yet. The two remaining go-live steps are the
> founder's: (a) create the AWS Org + credentials, (b) a gated `terraform
apply` after reviewing `terraform plan`.

```
infra/terraform/
  modules/
    network/        VPC, 3-AZ public/private/isolated subnets, NAT, VPC endpoints, flow logs
    kms/            One CMK per data class (rotation on)
    aurora/         Aurora PostgreSQL Serverless v2 (engine 16), TLS-forced
    redis/          ElastiCache Redis 7, TLS + at-rest encryption
    secrets/        Secrets Manager slots (empty) or TF-composed values
    s3-bucket/      Encrypted private bucket, optional Object Lock COMPLIANCE
    ecr/            Immutable-tag repo, scan-on-push, lifecycle prune
    alb/            Internet-facing ALB + target group (health: /v1/healthz)
    ecs-service/    Fargate service + one-off migration task + autoscaling
  envs/prod/us-east-1/
    versions.tf       providers + S3 remote-state backend
    variables.tf      all inputs (sane prod defaults)
    main.tf           KMS, S3, VPC, SGs, generated DB/Redis creds, Aurora, Redis, composed URLs
    secrets.tf        every env-contract secret as a slot + the ECS secrets mapping
    ecs.tf            ECR, cluster, IAM roles, ALB, API service
    outputs.tf        endpoints + names the runbook below needs
    terraform.tfvars.example
```

## How the API gets its configuration

`apps/api/src/config/env.ts` validates every variable at boot (fail-fast).
Config reaches the container two ways, both set in the ECS task definition:

- **Non-secret** → `environment` block: `NODE_ENV=production`, `AWS_REGION`,
  `PORT=3010`, `HOST`, `LOG_LEVEL`, `CORS_ORIGINS`, and the three
  `S3_BUCKET_*` names (Terraform knows these — they're not secret).
- **Secret** → `secrets` block (`valueFrom` = Secrets Manager ARN). ECS fetches
  the value at task start and injects it as an env var. The ECS **execution
  role** is scoped to read _only_ this service's secret ARNs and decrypt with
  the secrets CMK (`kms:Decrypt` on one key) — not `secretsmanager:*`.

`DATABASE_URL` and `REDIS_URL` are **composed by Terraform** from the Aurora /
Redis endpoints plus the generated passwords (`random_password`) and stored as
managed secrets — no plaintext literal ever appears in source. Every other
secret (`PII_*`, `JWT_*`, `MICAMP_*`, etc.) is an **empty slot**: Terraform
creates the resource; the founder injects the real value out-of-band (Step 7).
A later `terraform apply` will **not** clobber injected values
(`ignore_changes` on the placeholder version).

## PostGIS + database migrations

- The Prisma schema/migrations reference geography columns, but the initial
  migration's `CREATE EXTENSION ... postgis` is **commented out** so local dev
  (Postgres without PostGIS) can run migrations. PostGIS needs **no**
  `shared_preload_libraries` — so the Aurora cluster parameter group requires
  no preload entry.
- On Aurora, PostGIS is enabled by a **bootstrap SQL hook before migrations**:
  connect once and run `CREATE EXTENSION IF NOT EXISTS postgis;` (Aurora
  PostgreSQL 16 ships PostGIS 3.4). Then run `prisma migrate deploy`.
- The migration mechanism is a **one-off ECS task** (family
  `d2d-prod-api-migrate`, defined by the `ecs-service` module) using the same
  image + secrets, command `pnpm --filter api db:migrate`
  (`prisma migrate deploy`). Run it via `aws ecs run-task` **before** scaling
  the service to serve traffic (Step 8). It has a writable root FS (Prisma
  needs `/tmp`); the long-running service keeps `readonlyRootFilesystem=true`.

---

# Founder bootstrap runbook (DO THESE IN ORDER)

> Everything below is **manual and yours** — account creation and `apply` are
> not automated and were not run by the agent. Have the AWS CLI v2 + Terraform
> ≥ 1.6 installed locally.

### Step 1 — Create the AWS Org + accounts (click-ops, one time)

1. In the management account, **AWS Organizations → Create organization**.
2. Create an OU `Workloads` and a **dedicated `d2d-prod` member account**
   (prod isolation; do not run prod in the management account).
3. Enable **IAM Identity Center (SSO)**; assign yourself
   `AdministratorAccess` to `d2d-prod` via a permission set. **Do not create
   long-lived IAM access keys for humans** — use SSO + temporary credentials.
4. (Recommended) Turn on org-wide CloudTrail, Config, and a Service Control
   Policy denying root usage / region lockdown to `us-east-1`.

### Step 2 — Bootstrap the Terraform state backend (in `d2d-prod`)

Terraform can't store state in a bucket it hasn't made yet. Create these once,
by hand (names must match `versions.tf`):

```bash
aws sts get-caller-identity   # confirm you're in d2d-prod

aws s3api create-bucket --bucket d2d-prod-tfstate-us-east-1 --region us-east-1
aws s3api put-bucket-versioning --bucket d2d-prod-tfstate-us-east-1 \
  --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket d2d-prod-tfstate-us-east-1 \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-encryption --bucket d2d-prod-tfstate-us-east-1 \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'

aws dynamodb create-table --table-name d2d-prod-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1
```

### Step 3 — Configure credentials (no long-lived keys)

- **Local apply:** `aws sso login --profile d2d-prod`, then
  `export AWS_PROFILE=d2d-prod`.
- **CI (recommended):** a **GitHub OIDC** provider + IAM role assumed by the
  workflow — no secrets stored in GitHub. After the first apply you can manage
  this in Terraform; to deploy via the stretch workflow, create an OIDC role
  trusting `token.actions.githubusercontent.com` for your repo and set
  `AWS_DEPLOY_ROLE_ARN` as a repo variable. (See `.github/workflows/deploy-aws.yml`.)

### Step 4 — `terraform init` (with the real backend)

```bash
cd infra/terraform/envs/prod/us-east-1
cp terraform.tfvars.example terraform.tfvars   # edit non-secret params only
terraform init        # uses the S3 backend from Step 2
```

> Offline validation used `terraform init -backend=false`. For a real apply you
> must init **with** the backend (omit the flag).

### Step 5 — `terraform plan` (REVIEW before applying)

```bash
terraform plan -out tfplan
```

Expect ~one VPC (+3-AZ subnets, NAT×3, VPC endpoints), 3 KMS keys, 3 S3
buckets, Aurora Serverless v2 cluster (2 instances), Redis replication group,
~45 Secrets Manager secrets (mostly empty slots), ECR repo, ECS cluster +
service + migration task def, internet-facing ALB. **Read the plan.** Aurora +
the audit bucket have deletion protection / COMPLIANCE Object Lock — they are
intentionally hard to destroy.

### Step 6 — `terraform apply` (the gate)

```bash
terraform apply tfplan
```

On success, capture outputs:

```bash
terraform output            # alb_dns_name, ecs_cluster_name, migrate_task_family,
                            # private_subnet_ids, app_security_group_id, ECR url, ...
```

> The service starts with `desired_count=2` but the tasks will **fail health
> checks until secrets are injected and migrations run** (next steps). That is
> expected. Optionally set `api_desired_count=0` for the first apply, inject +
> migrate, then bump it back up.

### Step 7 — Inject real secret values (out-of-band)

For **every required secret** (and any optional integration you're enabling),
put the real value. Generate strong values locally — these never touch Terraform:

```bash
# Example shapes (see apps/api/src/config/env.ts for exact constraints):
aws secretsmanager put-secret-value --secret-id d2d/prod/PII_ENCRYPTION_KEY \
  --secret-string "$(openssl rand -hex 32)"        # 64 hex chars
aws secretsmanager put-secret-value --secret-id d2d/prod/JWT_ACCESS_SECRET \
  --secret-string "$(openssl rand -base64 48)"     # >=32 chars
# ...repeat for: PII_HASH_SECRET, PII_SEARCH_KEY, AUDIT_CHAIN_SECRET,
#    PII_KMS_KEY, PII_SIV_KEY (>=40 chars), JWT_REFRESH_SECRET,
#    JWT_WS_TICKET_SECRET, CSRF_SIGNING_SECRET, OAUTH_STATE_SECRET,
#    MFA_STEP_UP_SECRET, API_TOKEN_HASH_SECRET
```

`terraform output required_secret_arns` lists every required slot.
`DATABASE_URL`, `REDIS_URL`, `DB_MASTER`, `REDIS_AUTH` are **already populated**
by Terraform — do not overwrite them.

### Step 8 — Enable PostGIS + run migrations (one-off task)

PostGIS first (one-time), then migrations. Run the migration task in the
private subnets with the app SG (values from `terraform output`):

```bash
CLUSTER=$(terraform output -raw ecs_cluster_name)
FAMILY=$(terraform output -raw migrate_task_family)
SUBNETS=$(terraform output -json private_subnet_ids | jq -r 'join(",")')
SG=$(terraform output -raw app_security_group_id)

# 8a. Enable PostGIS once. Easiest: psql from a bastion / Cloud9 in-VPC, or add
#     `CREATE EXTENSION IF NOT EXISTS postgis;` as a run-task command override.
#     (Aurora PG16 includes PostGIS 3.4.) DATABASE_URL is in Secrets Manager.

# 8b. Apply Prisma migrations:
aws ecs run-task --cluster "$CLUSTER" \
  --task-definition "$FAMILY" --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=DISABLED}"
# tail logs at CloudWatch /d2d/d2d-prod-api (stream prefix d2d-prod-api-migrate)
```

### Step 9 — Verify

```bash
ALB=$(terraform output -raw alb_dns_name)
curl -fsS "http://$ALB/v1/healthz"   # {"status":"ok",...} (pre-TLS HTTP works)
curl -fsS "http://$ALB/v1/readyz"    # {"status":"ready","checks":{"db":"ok","redis":"ok"}}
```

- Target group healthy in EC2 → Target Groups.
- ECS service `RUNNING` desired count.
  Then issue an ACM cert for your domain, set `acm_certificate_arn`, re-apply (HTTP
  now 301-redirects to HTTPS), and point a Route53 alias at `alb_dns_name`.

---

## Rollback

- **App rollback** = deploy a previous **immutable** image tag (re-point the
  task def to the prior ECR digest) — never a rebuild. The ECS deployment
  circuit breaker auto-rolls-back a failed deploy.
- **Infra rollback** = revert the Terraform commit and `apply`. State is
  versioned in S3; the lock table prevents concurrent applies.
- **Data**: Aurora has 35-day PITR + in-region automated backups; the audit
  bucket is WORM (Object Lock COMPLIANCE, ~7y) and versioned.

## Cost (rough, us-east-1, low launch traffic)

| Resource                                 | ~$/mo        |
| ---------------------------------------- | ------------ |
| Aurora Serverless v2 (0.5–4 ACU, 2 inst) | 90–360       |
| ElastiCache `cache.t4g.small` ×2         | ~50          |
| 3× NAT gateways (+ data)                 | ~100+        |
| ALB                                      | ~20          |
| ECS Fargate (2× 0.5vCPU/1GB)             | ~35          |
| S3 + KMS + Secrets (~45) + logs          | ~30          |
| **Total**                                | **~325–600** |

Cost levers: drop to 1 NAT for non-HA dev; `aurora_min_acu`/`instance_count=1`;
`redis_replicas=0`. Reserved/Savings Plans once baseline is known. Every
resource carries `Project/Env/Region/Owner/ManagedBy` tags (provider
`default_tags`) for cost allocation.
